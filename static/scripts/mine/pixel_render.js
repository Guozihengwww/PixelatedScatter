import {pixel_render} from "./draw.js";

const DATA_NAME = 'Tweets_from_Members_of_US_Congress.json';
const MAX_KURTOSIS = 10; // 不能有低密度区域明显地把高密度区域盖住为宜
const MAX_LEVEL = 4; // 我们关心的最深的局部结构
const INIT_LEVEL = determineInitLevel();
const ALPHA_ENABLE = true;
const SUM_PROPORTION = 0.5;
const COLOR_SCHEME = [d3.hsl("#1f77b4").rgb(), d3.hsl("#ff7f0e").rgb(), d3.hsl("#2ca02c").rgb(), d3.hsl("#d62728").rgb(), d3.hsl("#9467bd").rgb(), d3.hsl("#8c564b").rgb(), d3.hsl("#e377c2").rgb(), d3.hsl("#7f7f7f").rgb(), d3.hsl("#bcbd22").rgb(), d3.hsl("#17becf").rgb()];

function clusterFilter(clustersToDraw, meshes, clusters) {
    const numList = clusters.map(cluster => cluster.map(g => g.points.length)), handleMeshes = [];
    for (let i = 0; i < numList.length; i++) {
        const tempCluster = numList[i];
        if (tempCluster.length === 1 || clusters[i][0].level >= MAX_LEVEL || calculateKurtosis(tempCluster) <= MAX_KURTOSIS) {
            clustersToDraw.push(clusters[i]);
            continue;
        }

        // else
        handleMeshes.push(meshes[i]);
    }
    return handleMeshes;
}

function fetchDat(data_name) {
    return new Promise(function (resolve, reject) {
        $.ajax({
            type: 'POST', url: '/read_data', data: {
                data_name: data_name
            }, success: (res) => {
                resolve(JSON.parse(res));
            }, error: (err) => {
                reject(err);
            }
        });
    });
}

fetchDat(DATA_NAME).then(async data_points => {
    scale_points(data_points);

    const start = performance.now();
    const size = pow(2, -INIT_LEVEL);
    const wInit = ceil(canvas_width / size), hInit = ceil(canvas_height / size);
    const initGrids = createArray(hInit, wInit), labelGrids = createArray(canvas_height, canvas_width),
        clusterGrids = createArray(canvas_height, canvas_width);
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
        if (!labelGrids[floor_y][floor_x].hasOwnProperty(p.label)) {
            labelGrids[floor_y][floor_x][p.label] = 1;
        } else labelGrids[floor_y][floor_x][p.label] += 1;
    }

    let meshesToHandle = [new GridMesh(initGrids, hInit, wInit)], clustersToDraw = [];
    while (meshesToHandle.length) {
        const tempMeshes = [];
        for (const m of meshesToHandle) {
            let [meshes, clusters] = m.cluster();
            meshes = clusterFilter(clustersToDraw, meshes, clusters);
            tempMeshes.push(...meshes);
        }
        meshesToHandle = [];
        for (const m of tempMeshes) {
            meshesToHandle.push(m.partition());
        }
    }

    // console.log(clustersToDraw)
    // 遍历clusters求像素重叠区域
    const sumP = number_clamp(0.5, 1, SUM_PROPORTION); // 非离群点比例
    let clustersInfo = new Array(clustersToDraw.length).fill(null); // [簇内点数，类别数，像素面积]
    let clusters = new Array(clustersToDraw.length).fill(null); // 簇的列表
    const pixelsOverlap = new Set(); // 记录多类簇的index以及重叠像素
    let pointNum, classes, pointArea, area, gx, gy, extents, dy, dx; // 簇的边界是extent
    clustersToDraw.forEach((clus, idxClu) => {
        pointNum = 0;
        classes = new Set();
        area = new Set();
        pointArea = new Set();
        extents = [];

        clus.forEach(grid => {
            if (grid.level < 0) {
                // 小于0时不用考虑重叠问题以及边长一定时整数，但面积需要特殊处理
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
        })

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
                prefer[dy][dx][label] = (prefer[dy][dx][label] || 0) + 1
                classesMutil[label] = (classesMutil[label] || 0) + 1
            });
        })

        clusters[idxClu] = new Cluster(extentY[0], extentX[0], classesMutil, prefer, sumP, area, pointArea, clus[0].level);
    })

    // 对于重叠像素进行处理
    for (const op of pixelsOverlap) {
        idx_y = floor(op);
        idx_x = round((op - idx_y) * 10000)

        const divisors = [];
        clusterGrids[idx_y][idx_x].forEach(idx => {
            const cluster = clustersInfo[idx];
            if (cluster) {
                const divisor = cluster[2] / cluster[1];
                divisors.push([idx, divisor]);
            }
        });

        // 对除数进行排序
        divisors.sort((a, b) => b[1] - a[1]);
        const idxs = divisors.slice(1).map(entry => entry[0]);
        for (const idx of idxs) {
            clusters[idx].fixedInsert([idx_y, idx_x]);
        }
    }

    if (ALPHA_ENABLE) {
        const densities = [];
        for (const cluster of clusters) {
            densities.push(cluster.densityEstimate());
        }
        // const density2Alpha = quantileScale(densities, [0.25, 1]);
        // const density2Alpha = d3.quantile(densities, 0.75) > 1 ? quantileScale(densities, [0.25, 1]) : quantileScale(densities, [0.25, 0.75]);
        // const density2Alpha = d3.scaleLinear().domain([0, d3.max(densities.map(d => d[0]))]).range([0, 1]);
        // console.log(d3.max(densities.map(d => d[0])));
        const density2Alpha = equalizeHist(densities);
        let fixed;
        for (const cluster of clusters) {
            const pixels = cluster.area.size;
            const grey = density2Alpha.get(cluster.densityReg), densityMap = cluster.densityMap();

            if (cluster.level < 0) { // 我们假设grey等于1时所有原始有点的地方都被填满
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
        const layouts = c.miniLayout();
        layouts.forEach(l => {
            draw_pixels.push({
                x: l.x,
                y: l.y,
                R: COLOR_SCHEME[l.label % 10].r,
                G: COLOR_SCHEME[l.label % 10].g,
                B: COLOR_SCHEME[l.label % 10].b
            });
        })
    }

    const pixelRenderer = pixel_render(draw_pixels);
    const end = performance.now();
    console.log("draw time:" + (end - start));
})