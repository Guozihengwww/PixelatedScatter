class Grid {
    constructor(coordinate, x, y, w, h, level) {
        this.coordinate = coordinate; // [row, col] ( [y, x] )
        this.x = x;
        this.y = y;
        this.w = w;
        this.h = h;
        this.level = level;
        this.points = [];
    }

    insert(p) {
        if (p instanceof Array) {
            this.points.push(...p);
            return;
        }

        this.points.push(p);
    }

    // 0 | 1
    //---|---
    // 2 | 3
    split() {
        const dx = this.w / 2;
        const dy = this.h / 2;
        const level = this.level + 1;
        const split_grids = d3.range(0, 4).map(e => new Grid([floor(e / 2), e % 2], this.x + dx * (e % 2), this.y + dy * floor(e / 2), dx, dy, level));
        let idx_x, idx_y, idx;

        for (const p of this.points) {
            idx_x = p._x >= dx ? 1 : 0;
            idx_y = p._y >= dy ? 1 : 0;
            idx = idx_x + idx_y * 2;
            p._x = p._x % dx;
            p._y = p._y % dy;
            split_grids[idx].insert(p);
        }
        this.points = [];

        return split_grids;
    }
}


class GridMesh {
    constructor(grids, rows, cols) {
        if (grids[0] instanceof Array) this.grids = grids; else alert("GridMesh in wrong format");
        this.rows = rows;
        this.cols = cols;
    }

    getLevel() {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                if (!this.grids[i][j]) continue;
                return this.grids[i][j].level;
            }
        }
    }

    // provides father grids, gives children grids
    partition() {
        const mesh = createArray(this.rows * 2, this.cols * 2);
        let singleMesh, coord;

        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                if (!this.grids[i][j]) continue;
                singleMesh = this.grids[i][j].split();

                // insert into final mesh
                for (const childGrid of singleMesh) {
                    if (!childGrid.points.length) continue;
                    coord = childGrid.coordinate;
                    mesh[i * 2 + coord[0]][j * 2 + coord[1]] = childGrid;
                }
            }
        }

        return new GridMesh(mesh, this.rows * 2, this.cols * 2);
    }

    cluster() {
        const clusterMap = new Map(), grids = this.grids;
        const clusterMatrix = createArray(this.rows, this.cols);
        let curCluster;

        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                if (!grids[i][j]) continue;
                if (!clusterMatrix[i][j]) {
                    curCluster = i + "_" + j;
                    clusterMap.set(curCluster, [[i, j]]);
                    clusterMatrix[i][j] = curCluster;
                } else curCluster = clusterMatrix[i][j];

                for (let dx = -1; dx < 2; dx++) {
                    for (let dy = 0; dy < 2; dy++) {
                        // Filter only the right and bottom; Boundary; No points
                        if (dy === 0 && dx < 1) continue;
                        if ((dx + j < 0) || (dx + j > (this.cols - 1)) || (dy + i > (this.rows - 1))) continue;
                        if (!grids[dy + i][dx + j]) continue;

                        if (!clusterMatrix[dy + i][dx + j]) {
                            clusterMatrix[dy + i][dx + j] = curCluster;
                            clusterMap.get(curCluster).push([dy + i, dx + j]);
                        } else if (clusterMatrix[dy + i][dx + j] === curCluster) continue; // same clusters meet
                        else {
                            let toMerge = clusterMatrix[dy + i][dx + j];
                            if (clusterMap.get(toMerge).length > clusterMap.get(curCluster).length) // make sure toMerge is less
                                [curCluster, toMerge] = [toMerge, curCluster];
                            const toMergeCoords = clusterMap.get(toMerge);
                            for (const toMergeCoord of toMergeCoords) {
                                clusterMatrix[toMergeCoord[0]][toMergeCoord[1]] = curCluster;
                            }

                            // push func‘s speedup
                            const chunkSize = 10000;
                            for (let i = 0; i < toMergeCoords.length; i += chunkSize) {
                                clusterMap.get(curCluster).push(...toMergeCoords.slice(i, i + chunkSize));
                            }
                            // clusterMap.get(curCluster).push(...toMergeCoords);
                            clusterMap.delete(toMerge);
                        }
                    }
                }
            }
        }

        // output to a mesh instead of a pointsList
        const clusters = [], clustersG = [];
        for (const [_, coords] of clusterMap) {
            const [row_low, row_high] = d3.extent(coords.map(e => e[0]));
            const [col_low, col_high] = d3.extent(coords.map(e => e[1]));
            const cluster_mesh = createArray(row_high - row_low + 1, col_high - col_low + 1), clusterGrids = [];
            for (const coord of coords) {
                cluster_mesh[coord[0] - row_low][coord[1] - col_low] = grids[coord[0]][coord[1]];
                clusterGrids.push(grids[coord[0]][coord[1]]);
            }
            clusters.push(new GridMesh(cluster_mesh, row_high - row_low + 1, col_high - col_low + 1));
            clustersG.push(clusterGrids);
        }

        return [clusters, clustersG];
    }
}

//
//
// const grid = new Grid([0, 0], 40, 40, 0);
//
// grid.insert([{_x: 15, _y: 10}, {_x: 25, _y: 15}, {_x: 12, _y: 13}, {_x: 20, _y: 20}, {_x: 35, _y: 35}])
// grid.insert([{_x: 10, _y: 10}, {_x: 15, _y: 15}, {_x: 12, _y: 13}, {_x: 20, _y: 20}, {_x: 35, _y: 35}])
//
// const mesh = createArray(1, 1);
// mesh[0][0] = grid;
// const grids = new GridMesh(mesh, 1, 1);
// console.log(grids.partition());