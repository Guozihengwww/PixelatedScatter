const PI = Math.PI;
const sqrt = Math.sqrt;
const max = Math.max;
const min = Math.min;
const atan2 = Math.atan2;
const atan = Math.atan;
const tan = Math.tan;
const pow = Math.pow;
const floor = Math.floor;
const ceil = Math.ceil;
const abs = Math.abs;
const exp = Math.exp;
const log = Math.log;
const round = Math.round;
const random = Math.random;
const sqrt_3 = Math.sqrt(3);

function scale_points(data_points, THRESHOLD = 0.000001, [min_x, max_x] = [0, canvas_width], [min_y, max_y] = [0, canvas_height]) {
    // scale datapoints into grids
    const [packed_min_x, packed_max_x] = d3.extent(data_points, d => d.x);
    const [packed_min_y, packed_max_y] = d3.extent(data_points, d => d.y);
    const packed_x_scale = d3.scaleLinear()
        .domain([packed_min_x, packed_max_x])
        .range([min_x, max_x - THRESHOLD]);
    const packed_y_scale = d3.scaleLinear()
        .domain([packed_min_y, packed_max_y])
        .range([min_y, max_y - THRESHOLD]);
    for (const p of data_points) {
        p.x = packed_x_scale(p.x);
        p.y = packed_y_scale(p.y);
    }
}

// auto calculate level
function determineInitLevel(canvasWidth = canvas_width, canvasHeight = canvas_height) {
    const maxDimension = Math.max(canvasWidth, canvasHeight);

    const baseDimension = 1000;
    const baseLevel = -1;
    const powerOfTwo = Math.log2(maxDimension / baseDimension);
    const calculatedLevel = baseLevel - powerOfTwo;

    return Math.round(calculatedLevel);
}

function blendColors(colors, weights = []) {
    const blendedColor = colors.reduce((acc, color, i) => {
        acc.r += color.r * weights[i];
        acc.g += color.g * weights[i];
        acc.b += color.b * weights[i];

        return acc;
    }, {r: 0, g: 0, b: 0});

    return d3.rgb(blendedColor.r, blendedColor.g, blendedColor.b);
}


function createArray(rows, cols, fill = null) {
    return Array.from({length: rows}, () => new Array(cols).fill(fill));
}

function format_(num, decimals = 3) {
    return parseFloat(num.toFixed(decimals));
}

const number_clamp = (min, max, num) => {
    return Math.max(Math.min(num, max), min)
}

// difference set
function mapSetDiff(mapA, setB) {
    const intersectionMap = new Map();
    for (const elem of setB) {
        if (mapA.has(elem)) {
            intersectionMap.set(elem, mapA.get(elem));
            mapA.delete(elem);
        }
    }
    return intersectionMap;
}

function mapMerge(mapA, mapB) {
    mapB.forEach((key, value) => {
        mapA.set(key, value);
    });
}

function array_range(arr) {
    const [min, max] = d3.extent(arr);
    return max - min;
}

const objSize = (obj) => {
    return Object.keys(obj).length;
}

function standardDeviation(arr, median) {
    const variance = arr.reduce((acc, num) => acc + Math.pow(num - median, 2), 0) / arr.length;
    return Math.sqrt(variance);
}

function calculateKurtosis(numList) {
    const median = d3.quantile(numList, 0.5);
    const std_dev = standardDeviation(numList, median);
    if (std_dev === 0) {
        return 0;
    }
    const z_scores = numList.map(num => (num - median) / std_dev);
    const kurtosis = z_scores.reduce((acc, z) => acc + Math.pow(z, 4), 0) / numList.length;
    return kurtosis - 3;
}

// frequency equalization
function equalizeHist(greys) {
    // density function
    const bins = greys.sort((a, b) => a[0] - b[0]).map(d => d[0]);
    const weights = greys.map(d => d[1]);
    const min = 0, max = 1;
    const grey2fre = new Map()
    for (let i = 0; i < bins.length; i++) {
        if (grey2fre.has(bins[i])) grey2fre.set(bins[i], grey2fre.get(bins[i]) + weights[i]); else grey2fre.set(bins[i], weights[i]);
    }

    // distributed function
    let sumCurrent = 0;
    const greyFre_arr = [...grey2fre].sort((a, b) => a[0] - b[0]);
    const grey2cum = new Map();
    for (let i = 0; i < greyFre_arr.length; i++) {
        sumCurrent += greyFre_arr[i][1];
        grey2cum.set(greyFre_arr[i][0], sumCurrent);
    }

    // console.log(JSON.stringify(greyFre_arr))
    // console.log(grey2cum)
    // output Old_greys To New_greys
    let greysLength = grey2cum.get(greyFre_arr[greyFre_arr.length - 1][0]), greysMap = new Map();
    bins.forEach((grey, idx) => {
        greysMap.set(grey, grey2cum.get(grey) / greysLength * (max - min) + min);
    });
    // console.log(greysMap)
    // console.log(JSON.stringify(greyFre_arr.map(e => [greysMap.get(e[0]), e[1]])));
    return greysMap;
}