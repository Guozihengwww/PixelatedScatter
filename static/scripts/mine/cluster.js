// --- START OF FILE cluster.js ---

class Cluster {
    /**
     * Represents a cluster of data points.
     * @param {number} dy - The y-offset of the cluster's bounding box.
     * @param {number} dx - The x-offset of the cluster's bounding box.
     * @param {object} classes - An object containing class labels and their point counts.
     * @param {Array<Array<object>>} preferMesh - A 2D array representing preferred locations for each class.
     * @param {number} sump - The proportion of non-outlier points.
     * @param {Set<number>} areas - A set of unique area identifiers for the cluster.
     * @param {Set<number>} pointArea - A set of unique area identifiers occupied by actual points.
     * @param {number} level - The grid level of this cluster.
     * @param {number} highlightOut - A factor to highlight outlier classes.
     */
    constructor(dy, dx, classes, preferMesh, sump, areas, pointArea, level, highlightOut) {
        this.dy = dy;
        this.dx = dx;
        this.classes = Object.entries(classes);
        this.preferMesh = preferMesh;
        this.tol = this.classes.length > 1 ? (1 - sump) * this.classes.length / (this.classes.length - 1) : 0;
        this.level = level;
        this.area = areas; // Area with offset
        this.pointArea = pointArea; // Point area might differ from 'area' if level < 0
        this.highlightOut = highlightOut; // Parameter for highlighting outliers
        this.fixedGrids = [];
        this.pixelNum = {};
        this.layout = [];
        this.outliers = [];
        this.nonOutliers = [];
        this.densityReg = 0;
    }

    /**
     * Estimates the density of the cluster.
     * @returns {[number, number]} - An array containing density and area size.
     */
    densityEstimate() {
        if (this.area.size === 0) return [0, 0];
        this.densityReg = d3.sum(this.classes, c => c[1]) / this.area.size;
        return [this.densityReg, this.area.size];
    }

    /**
     * Creates a map of grid cell densities.
     * @returns {Array<[Array<number>, number]>} - A sorted array of [coordinates, density].
     */
    densityMap() {
        let idx_x, idx_y, dy, dx;
        const densityMap = [];
        const area = this.level >= 0 ? this.area : this.pointArea;
        for (const o of area) {
            idx_y = floor(o);
            dy = idx_y - this.dy;
            idx_x = round((o - floor(o)) * 10000);
            dx = idx_x - this.dx;
            densityMap.push([[idx_y, idx_x], d3.sum(Object.values(this.preferMesh[dy][dx]))]);
        }
        return densityMap.sort((a, b) => a[1] - b[1]);
    }

    /**
     * Converts area coordinates from global to local (relative to the cluster's offset).
     * @param {Set<number>} areasOri - The original set of area identifiers.
     * @returns {Set<number>} - The new set of area identifiers.
     */
    areaConvert(areasOri) {
        let idx_x, idx_y;
        const areasNew = new Set();
        for (const o of areasOri) {
            idx_y = floor(o) - this.dy;
            idx_x = round((o - floor(o)) * 10000) - this.dx
            areasNew.add(idx_y + idx_x / 10000);
        }
        return areasNew;
    }

    /**
     * Converts layout coordinates from local to global (actual pixel positions).
     * @returns {Array<object>} - The layout with absolute coordinates.
     */
    layoutConvert() {
        return this.layout.map(p => {
            return {'x': this.dx + p.dx, 'y': this.dy + p.dy, 'label': p.label};
        })
    }

    /**
     * Marks a grid cell as fixed, removing it from the available area for layout.
     * @param {Array<number>} coord - The [y, x] coordinate of the grid cell to fix.
     */
    fixedInsert(coord) {
        this.fixedGrids.push(coord);
        this.area.delete(coord[0] + coord[1] / 10000);
        this.pointArea.delete(coord[0] + coord[1] / 10000);
    }

    /**
     * Separates classes into outliers and non-outliers based on a tolerance threshold.
     */
    outlierSep() {
        const totalPoints = d3.sum(this.classes, c => c[1]);
        const threshold = this.tol * totalPoints / this.classes.length;
        this.classes.forEach(([key, value]) => {
            if (value < threshold) {
                this.outliers.push([key, value]);
            } else {
                this.nonOutliers.push([key, value]);
            }
        });
        this.outliers.sort((a, b) => a[1] - b[1]);
        this.nonOutliers.sort((a, b) => a[1] - b[1]);
    }

    /**
     * Distributes the available pixels among the classes.
     */
    numberDistribution() {
        this.outlierSep();

        const totalPoints = d3.sum(this.classes, c => c[1]);
        const totalNonOutliers = d3.sum(this.nonOutliers, e => e[1]);
        let hLight;
        if (this.outliers.length) {
            const outlierMax = this.outliers[this.outliers.length - 1][1];
            const nonOutlierMinP = this.nonOutliers[0][1] / totalNonOutliers;
            const hLightThreshold = totalPoints / (d3.sum(this.outliers, e => e[1]) + outlierMax / nonOutlierMinP);
            hLight = min(this.highlightOut, hLightThreshold);
        }

        const totalPixels = this.level >= 0 ? this.area.size : this.pointArea.size;
        let tempP = 0, restPixels = totalPixels;
        for (const outlier of this.outliers) {
            tempP = max(round(hLight * outlier[1] / totalPoints * totalPixels), 1);
            if (tempP >= restPixels) {
                this.pixelNum[outlier[0]] = restPixels;
                return;
            } else {
                restPixels -= tempP;
                this.pixelNum[outlier[0]] = tempP;
            }
        }

        // Distribute pixels for non-outliers
        const nonPixels = restPixels;
        for (const nonOutlier of this.nonOutliers) {
            tempP = max(round(nonOutlier[1] / totalNonOutliers * nonPixels), 1);
            if (tempP >= restPixels) {
                this.pixelNum[nonOutlier[0]] = restPixels;
                return;
            } else {
                restPixels -= tempP;
                this.pixelNum[nonOutlier[0]] = tempP;
            }
        }
    }

    /**
     * Lays out the pixels for overlapping classes.
     */
    layoutOverlapped() {
        this.numberDistribution();
        this.area = this.areaConvert(this.area); // Convert to local coordinates
        const classAreas = {};
        let idx_x, idx_y;

        // Construct position information for each class
        for (const coord of this.area) {
            idx_y = floor(coord);
            idx_x = round((coord - idx_y) * 10000);
            Object.entries(this.preferMesh[idx_y][idx_x]).forEach(([key, value]) => {
                if (!classAreas.hasOwnProperty(key)) {
                    classAreas[key] = [new Map(), new Map()]
                }
                classAreas[key][0].set(coord, value);
            });
        }
        for (const coord of this.fixedGrids) { // Fixed grids are considered occupied
            idx_y = round(coord[0] - this.dy);
            idx_x = round(coord[1] - this.dx);
            Object.entries(this.preferMesh[idx_y][idx_x]).forEach(([key, value]) => {
                if (!classAreas.hasOwnProperty(key)) {
                    classAreas[key] = [new Map(), new Map()]
                }
                classAreas[key][1].set(idx_y + idx_x / 10000, value);
            });
        }

        // Align classAreas with pixelNum
        for (const label in classAreas) {
            if (!this.pixelNum.hasOwnProperty(label)) delete classAreas[label];
        }

        // Initial layout based on density
        while (Object.keys(classAreas).length > 0) {
            let minLength = Infinity;
            let selectedLabel = null;

            for (const label in classAreas) {
                const mapLength = classAreas[label][0].size;
                const currentLength = mapLength / this.pixelNum[label];
                if (currentLength < minLength) {
                    minLength = currentLength;
                    selectedLabel = label;
                }
            }

            const map1 = classAreas[selectedLabel][0], map2 = classAreas[selectedLabel][1];
            const size1 = map1.size, size2 = map2.size, totalSize = size1 + size2,
                pixelNum = this.pixelNum[selectedLabel];
            let gridOccupied;

            if (pixelNum <= totalSize) {
                if (pixelNum <= size1) {
                    gridOccupied = Array.from(map1.entries()).sort((a, b) => b[1] - a[1]).slice(0, pixelNum);
                } else {
                    gridOccupied = Array.from(map1.entries());
                    const sortedMap2Entries = Array.from(map2.entries()).sort((a, b) => b[1] - a[1]).slice(0, pixelNum - size1);
                    gridOccupied.push(...sortedMap2Entries);
                }

                // Chunking for performance
                const chunkSize = 10000;
                for (let i = 0; i < gridOccupied.length; i += chunkSize) {
                    const chunk = gridOccupied.slice(i, i + chunkSize);
                    const processedChunk = chunk.map(e => {
                        const idx_y = Math.floor(e[0]);
                        const idx_x = Math.round((e[0] - idx_y) * 10000);
                        return {'dy': idx_y, 'dx': idx_x, 'label': selectedLabel};
                    });
                    this.layout.push(...processedChunk);
                }
            } else {
                const multiple = floor(pixelNum / totalSize);
                const entries = Array.from(map1.entries()).concat(Array.from(map2.entries()));
                for (let i = 0; i < multiple; i++) {
                    const chunkSize = 10000;
                    for (let j = 0; j < entries.length; j += chunkSize) {
                        const chunk = entries.slice(j, j + chunkSize);
                        const processedChunk = chunk.map(e => {
                            const idx_y = Math.floor(e[0]);
                            const idx_x = Math.round((e[0] - idx_y) * 10000);
                            return {'dy': idx_y, 'dx': idx_x, 'label': selectedLabel};
                        });
                        this.layout.push(...processedChunk);
                    }
                }
                gridOccupied = entries.sort((a, b) => b[1] - a[1]).slice(0, pixelNum - multiple * entries.length);
                this.layout.push(...gridOccupied.map(e => {
                    idx_y = floor(e[0]);
                    idx_x = round((e[0] - idx_y) * 10000);
                    return {'dy': idx_y, 'dx': idx_x, 'label': selectedLabel}
                }));
            }
            gridOccupied = new Set(gridOccupied.map(e => e[0]));
            delete classAreas[selectedLabel];

            // Update remaining class areas
            for (const label in classAreas) {
                mapMerge(classAreas[label][1], mapSetDiff(classAreas[label][0], gridOccupied));
            }
        }
    }

    /**
     * Performs a minimal layout using a k-d tree like approach to place pixels.
     * @returns {Array<object>} - The final layout of pixels.
     */
    miniLayout() {
        function kd_aux(pix, area) {
            let pixels, areas, regions = [[pix, area]], outputs = [];
            while (regions.length > 0) {
                [pixels, areas] = regions.pop();
                if (pixels.length < 1) {
                    continue;
                }
                if (pixels.length === 1) {
                    outputs.push({'dy': areas[0][0], 'dx': areas[0][1], 'label': pixels[0]['label']});
                } else {
                    const extentY = d3.extent(areas.map(g => g[0])), extentX = d3.extent(areas.map(g => g[1]));
                    const middleIndex = floor(pixels.length / 2);
                    let area1, area2;
                    if (extentY[1] - extentY[0] >= extentX[1] - extentX[0]) {
                        pixels.sort((a, b) => a.dy - b.dy);
                        const splitY_line = number_clamp(extentY[0], extentY[1], pixels[middleIndex].dy);
                        area1 = areas.filter(g => g[0] <= splitY_line);
                        area2 = areas.filter(g => g[0] > splitY_line);
                        if (area1.length === 0 || area2.length === 0) {
                            area1 = areas.filter(g => g[0] < splitY_line);
                            area2 = areas.filter(g => g[0] >= splitY_line);
                        }
                        const pixels_1 = pixels.slice(0, area1.length);
                        const pixels_2 = pixels.slice(area1.length);
                        regions.push([pixels_1, area1], [pixels_2, area2]);
                    } else {
                        pixels.sort((a, b) => a.dx - b.dx);
                        let splitX_line;
                        splitX_line = number_clamp(extentX[0], extentX[1], pixels[middleIndex].dx);
                        area1 = areas.filter(g => g[1] < splitX_line);
                        area2 = areas.filter(g => g[1] >= splitX_line);
                        if (area1.length === 0 || area2.length === 0) {
                            area1 = areas.filter(g => g[1] <= splitX_line);
                            area2 = areas.filter(g => g[1] > splitX_line);
                        }
                        const pixels_1 = pixels.slice(0, area1.length);
                        const pixels_2 = pixels.slice(area1.length);
                        regions.push([pixels_1, area1], [pixels_2, area2]);
                    }
                }
            }
            return outputs;
        }

        this.area = this.level >= 0 ? this.area : this.pointArea;

        if (this.area.size < 1) {
            return [];
        } else if (this.classes.length === 1) {
            const layout = [], label = this.classes[0][0];
            for (const g of this.area) {
                layout.push({
                    'y': floor(g), 'x': round((g - floor(g)) * 10000), 'label': label
                });
            }
            return layout;
        }

        this.layoutOverlapped();
        const layoutOri = [...this.layout], areas_arr = [];
        for (const g of this.area) {
            areas_arr.push([floor(g), round((g - floor(g)) * 10000)])
        }
        this.layout = kd_aux(layoutOri, areas_arr);
        return this.layoutConvert();
    }
}