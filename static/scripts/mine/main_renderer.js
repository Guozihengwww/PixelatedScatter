import {pixel_render} from "./draw.js";

const COLOR_SCHEME = [d3.hsl("#1f77b4").rgb(), d3.hsl("#ff7f0e").rgb(), d3.hsl("#2ca02c").rgb(), d3.hsl("#d62728").rgb(), d3.hsl("#9467bd").rgb(), d3.hsl("#8c564b").rgb(), d3.hsl("#e377c2").rgb(), d3.hsl("#7f7f7f").rgb(), d3.hsl("#bcbd22").rgb(), d3.hsl("#17becf").rgb()];
let pixelRenderer = null;

function clusterFilter(clustersToDraw, meshes, clusters, config) {
    const numList = clusters.map(cluster => cluster.map(g => g.points.length));
    const handleMeshes = [];
    for (let i = 0; i < numList.length; i++) {
        const tempCluster = numList[i];
        if (tempCluster.length === 1 || clusters[i][0].level >= config.MAX_LEVEL || calculateKurtosis(tempCluster) <= config.MAX_KURTOSIS) {
            clustersToDraw.push(clusters[i]);
            continue;
        }
        handleMeshes.push(meshes[i]);
    }
    return handleMeshes;
}

function fetchDat(dataName) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: 'POST', url: '/read_data', data: {data_name: dataName}, success: (res) => {
                resolve(res);
            }, error: (err) => {
                reject(err);
            }
        });
    });
}

/**
 * Updates the text of the loading indicator.
 * @param {string} text - The message to display.
 */
export function setLoadingState(text) {
    d3.select('#loading-text').text(text);
}

/**
 * Updates the data information overlay on the canvas.
 * @param {Array} data_points - The dataset.
 */
function updateDataInfoOverlay(data_points) {
    const pointCount = data_points.length;
    const labelCount = new Set(data_points.map(p => p.label)).size;
    const overlay = d3.select('#data-info-overlay');
    const plotRect = d3.select('#plot-container').node().getBoundingClientRect();

    overlay
        .style('display', 'block')
        .style('position', 'absolute') // Position relative to body/app-container
        .style('top', `${plotRect.top + 10}px`)
        .style('left', `${plotRect.left + 10}px`)
        .html(`Points: <strong>${pointCount.toLocaleString()}</strong><br>Labels: <strong>${labelCount}</strong>`);
}

export async function runVisualization(config, data = null) {
    console.time("Total Render Time");
    const canvasElement = document.getElementById('my_canvas');
    if (!canvasElement) {
        console.error("Canvas not found!");
        return;
    }

    canvasElement.width = config.CANVAS_WIDTH;
    canvasElement.height = config.CANVAS_HEIGHT;

    await new Promise(resolve => requestAnimationFrame(resolve));

    // --- Loading Step 1: Fetching Data ---
    setLoadingState(data ? 'Processing uploaded data...' : 'Fetching data from server...');
    const data_points = data ? data : await fetchDat(config.DATA_NAME);

    // Allow the DOM to update the loading text
    await new Promise(resolve => setTimeout(resolve, 10));

    updateDataInfoOverlay(data_points);
    scale_points(data_points, 0.000001, [0, config.CANVAS_WIDTH], [0, config.CANVAS_HEIGHT]);

    // --- Loading Step 2: Computing Layout ---
    setLoadingState('Computing layout & clusters...');
    await new Promise(resolve => setTimeout(resolve, 10));

    const start = performance.now();
    const INIT_LEVEL = config.INIT_LEVEL_MODE === 'auto' ? determineInitLevel(config.CANVAS_WIDTH, config.CANVAS_HEIGHT) : config.INIT_LEVEL_MANUAL;

    const size = pow(2, -INIT_LEVEL);
    const wInit = ceil(config.CANVAS_WIDTH / size), hInit = ceil(config.CANVAS_HEIGHT / size);
    const initGrids = createArray(hInit, wInit), labelGrids = createArray(config.CANVAS_HEIGHT, config.CANVAS_WIDTH),
        clusterGrids = createArray(config.CANVAS_HEIGHT, config.CANVAS_WIDTH);

    let idx_x, idx_y, floor_x, floor_y;
    for (const p of data_points) {
        floor_x = floor(p.x);
        floor_y = floor(p.y);
        idx_x = floor(p.x / size);
        idx_y = floor(p.y / size);
        p._x = p.x - idx_x * size;
        p._y = p.y - idx_y * size;
        if (!initGrids[idx_y][idx_x]) {
            initGrids[idx_y][idx_x] = new Grid([0, 0], idx_x * size, idx_y * size, size, size, INIT_LEVEL);
        }
        initGrids[idx_y][idx_x].insert(p);
        if (!labelGrids[floor_y][floor_x]) {
            labelGrids[floor_y][floor_x] = {};
        }
        labelGrids[floor_y][floor_x][p.label] = (labelGrids[floor_y][floor_x][p.label] || 0) + 1;
    }
    let meshesToHandle = [new GridMesh(initGrids, hInit, wInit)], clustersToDraw = [];
    while (meshesToHandle.length) {
        const tempMeshes = [];
        for (const m of meshesToHandle) {
            let [meshes, clusters] = m.cluster();
            meshes = clusterFilter(clustersToDraw, meshes, clusters, config);
            tempMeshes.push(...meshes);
        }
        meshesToHandle = [];
        for (const m of tempMeshes) {
            meshesToHandle.push(m.partition());
        }
    }
    const sumP = number_clamp(0.5, 1, config.SUM_PROPORTION);
    let clustersInfo = new Array(clustersToDraw.length).fill(null);
    let clusters = new Array(clustersToDraw.length).fill(null);
    const pixelsOverlap = new Set();
    let pointNum, classes, pointArea, area, gx, gy, extents, dy, dx;
    clustersToDraw.forEach((clus, idxClu) => {
        pointNum = 0;
        classes = new Set();
        area = new Set();
        pointArea = new Set();
        extents = [];
        clus.forEach(grid => {
            if (grid.level < 0) {
                for (gy = grid.y; gy < grid.y + grid.h; gy++) {
                    for (gx = grid.x; gx < grid.x + grid.w; gx++) {
                        area.add(gy + gx / 10000);
                    }
                }
                extents.push([grid.y, grid.x], [grid.y + grid.h, grid.x + grid.w]);
                grid.points.forEach(p => {
                    pointArea.add(floor(p.y) + floor(p.x) / 10000);
                });
            } else {
                [gy, gx] = [floor(grid.y), floor(grid.x)];
                area.add(gy + gx / 10000);
                if (!clusterGrids[gy][gx]) {
                    clusterGrids[gy][gx] = [idxClu];
                } else if (clusterGrids[gy][gx].slice(-1)[0] !== idxClu) {
                    clusterGrids[gy][gx].push(idxClu);
                    pixelsOverlap.add(gy + gx / 10000);
                }
                extents.push([gy, gx]);
            }
            const gridPoints = grid.points;
            pointNum += gridPoints.length;
            const chunkSize = 10000;
            for (let i = 0; i < gridPoints.length; i += chunkSize) {
                classes.add(...gridPoints.slice(i, i + chunkSize).map(g => g.label));
            }
        });
        clustersInfo[idxClu] = [pointNum, classes.size, area.size];
        const extentY = d3.extent(extents.map(g => g[0])), extentX = d3.extent(extents.map(g => g[1]));
        const prefer = createArray(extentY[1] - extentY[0] + 1, extentX[1] - extentX[0] + 1);
        const classesMutil = {};
        clus.forEach(grid => {
            grid.points.forEach(p => {
                dy = floor(p.y) - extentY[0];
                dx = floor(p.x) - extentX[0];
                const label = p.label;
                if (!prefer[dy][dx]) {
                    prefer[dy][dx] = {};
                }
                prefer[dy][dx][label] = (prefer[dy][dx][label] || 0) + 1;
                classesMutil[label] = (classesMutil[label] || 0) + 1;
            });
        });
        clusters[idxClu] = new Cluster(extentY[0], extentX[0], classesMutil, prefer, sumP, area, pointArea, clus[0].level, config.HIGHLIGHT_OUT);
    });
    for (const op of pixelsOverlap) {
        idx_y = floor(op);
        idx_x = round((op - idx_y) * 10000);
        const divisors = [];
        clusterGrids[idx_y][idx_x].forEach(idx => {
            const cluster = clustersInfo[idx];
            if (cluster) {
                divisors.push([idx, cluster[2] / cluster[1]]);
            }
        });
        divisors.sort((a, b) => b[1] - a[1]);
        const idxs = divisors.slice(1).map(entry => entry[0]);
        for (const idx of idxs) {
            if (clusters[idx]) clusters[idx].fixedInsert([idx_y, idx_x]);
        }
    }
    if (config.ALPHA_ENABLE) {
        const densities = [];
        for (const cluster of clusters) {
            if (cluster) densities.push(cluster.densityEstimate());
        }
        const density2Alpha = equalizeHist(densities);
        let fixed;
        for (const cluster of clusters) {
            if (!cluster) continue;
            const pixels = cluster.area.size;
            const grey = density2Alpha.get(cluster.densityReg), densityMap = cluster.densityMap();
            if (cluster.level < 0) {
                fixed = cluster.pointArea.size - max(round(pixels * grey), cluster.pointArea.size);
            } else {
                fixed = round(pixels * (1 - grey));
            }
            for (let i = 0; i < fixed; i++) {
                cluster.fixedInsert(densityMap[i][0]);
            }
        }
    }
    const draw_pixels = [];
    for (const c of clusters) {
        if (!c) continue;
        const layouts = c.miniLayout();
        layouts.forEach(l => {
            draw_pixels.push({
                x: l.x,
                y: l.y,
                R: COLOR_SCHEME[l.label % 10].r,
                G: COLOR_SCHEME[l.label % 10].g,
                B: COLOR_SCHEME[l.label % 10].b
            });
        });
    }

    // --- Loading Step 3: Rendering ---
    setLoadingState('Rendering pixels...');
    await new Promise(resolve => setTimeout(resolve, 10));

    if (!pixelRenderer) {
        pixelRenderer = pixel_render(canvasElement, draw_pixels);
    } else {
        pixelRenderer.resize();
        pixelRenderer.updateData(draw_pixels);
    }

    const end = performance.now();
    console.log("Algorithm and layout time: " + (end - start) + "ms");
    console.timeEnd("Total Render Time");
}