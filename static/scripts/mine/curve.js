import {runVisualization} from './main_renderer.js';

const defaultConfig = {
    DATA_NAME: 'Hathi_trust_library.json',
    CANVAS_WIDTH: 900,
    CANVAS_HEIGHT: 900,
    MAX_KURTOSIS: 10,
    MAX_LEVEL: 4,
    ALPHA_ENABLE: true,
    SUM_PROPORTION: 0.5,
    HIGHLIGHT_OUT: 10,
    INIT_LEVEL_MODE: 'auto',
    INIT_LEVEL_MANUAL: 0,
};

const availableDatasets = ['BlackFriday.json', 'Forest_covertype.json', 'Person_activity.json', 'Hathi_trust_library.json', 'Dc_census_citizens.json', 'Cup98LRN.json', 'MoCap.json', 'HT_sensor.json', 'Gas_sensor_array_drift.json', 'CS_rankings.json', 'Daily_sports.json', 'DBLP_samples.json', 'News.json', 'Paleontology.json', 'Copter.json', 'News_aggregator.json', 'Nomic_Ada_Wiki.json', 'Online_News.json', 'Tweets_from_Members_of_US_Congress.json', 'X_Community_Notes.json'];

let currentData = null; // Holds data from an uploaded file

function initializeUI() {
    const appContainer = d3.select('body').append('div').attr('id', 'app-container');
    const plotContainer = appContainer.append('div').attr('id', 'plot-container');
    const controlPanel = appContainer.append('div').attr('id', 'control-panel');

    const l_win = plotContainer.append('div').attr('id', 'l_win');
    l_win.append('canvas').attr('id', 'my_canvas');
    plotContainer.append('div').attr('id', 'data-info-overlay');

    const loadingIndicator = plotContainer.append('div').attr('id', 'loading-indicator');
    loadingIndicator.append('div').attr('class', 'loader-spinner');
    loadingIndicator.append('div').attr('id', 'loading-text');

    controlPanel.append('h2').text('PixelatedScatter').style('text-align', 'center');

    const dataCard = controlPanel.append('div').attr('class', 'control-card');
    dataCard.append('div').attr('class', 'card-header').html('<i class="fa-solid fa-database"></i> Dataset');
    let formGroup = dataCard.append('div').attr('class', 'form-group');
    formGroup.append('label').attr('for', 'dataset-select').text('Select a built-in dataset:');
    const datasetSelect = formGroup.append('select').attr('id', 'dataset-select');
    datasetSelect.selectAll('option').data(availableDatasets).enter().append('option')
        .attr('value', d => d)
        .property('selected', d => d === defaultConfig.DATA_NAME)
        .text(d => d.replace('.json', ''));
    formGroup = dataCard.append('div').attr('class', 'form-group');
    formGroup.append('label').attr('for', 'upload-input').text('Or upload a JSON file:');
    formGroup.append('input').attr('type', 'file').attr('id', 'upload-input').attr('accept', '.json');

    const paramsCard = controlPanel.append('div').attr('class', 'control-card');
    paramsCard.append('div').attr('class', 'card-header').html('<i class="fa-solid fa-sliders"></i> Parameters');
    addNumericInput(paramsCard, 'Canvas Width', 'canvas-width', defaultConfig.CANVAS_WIDTH, 300, 2000, 10);
    addNumericInput(paramsCard, 'Canvas Height', 'canvas-height', defaultConfig.CANVAS_HEIGHT, 300, 2000, 10);
    addNumericInput(paramsCard, 'Kurtosis Threshold (θₖ)', 'max-kurtosis', defaultConfig.MAX_KURTOSIS, 1, 50, 1);
    addNumericInput(paramsCard, 'Outlier Emphasis (h)', 'highlight-out', defaultConfig.HIGHLIGHT_OUT, 1, 50, 1);

    formGroup = paramsCard.append('div').attr('class', 'form-group').style('margin-top', '20px');
    formGroup.append('label').html('Initial Grid Level (L<sub>init</sub>)');
    const radioGroup = formGroup.append('div').attr('class', 'radio-group');
    radioGroup.html(`<label><input type="radio" name="init-level-mode" value="auto" checked> Auto</label> <label><input type="radio" name="init-level-mode" value="manual"> Manual</label>`);
    const manualInputGroup = addNumericInput(formGroup, '', 'init-level-manual', defaultConfig.INIT_LEVEL_MANUAL, -5, 5, 1);
    manualInputGroup.style('display', 'none');
    d3.selectAll('input[name="init-level-mode"]').on('change', function () {
        manualInputGroup.style('display', this.value === 'manual' ? 'block' : 'none');
    });

    controlPanel.append('button').attr('id', 'render-btn').html('<i class="fa-solid fa-play"></i> Apply & Render');

    d3.select('#render-btn').on('click', handleRender);
    d3.select('#upload-input').on('change', handleFileUpload);

    datasetSelect.on('change', function () {
        if (this.value !== 'uploaded') {
            currentData = null;
            const uploadedOption = this.querySelector('option[value="uploaded"]');
            if (uploadedOption) {
                uploadedOption.remove();
            }
            d3.select('#upload-input').property('value', '');
        }
    });

    handleRender();
}

function addNumericInput(parent, label, id, defaultValue, min, max, step) {
    const group = parent.append('div').attr('class', 'form-group');
    if (label) group.append('label').attr('for', id).html(label);
    group.append('input').attr('type', 'number').attr('id', id).attr('value', defaultValue).attr('min', min).attr('max', max).attr('step', step);
    return group;
}

async function handleRender() {
    d3.select('#loading-indicator').style('display', 'flex');
    const selectedDatasetValue = d3.select('#dataset-select').property('value');
    const useUploadedData = selectedDatasetValue === 'uploaded' && currentData;
    const dataToRender = useUploadedData ? currentData : null;

    const config = {
        DATA_NAME: useUploadedData ? 'uploaded_data.json' : selectedDatasetValue,
        CANVAS_WIDTH: +d3.select('#canvas-width').property('value'),
        CANVAS_HEIGHT: +d3.select('#canvas-height').property('value'),
        MAX_KURTOSIS: +d3.select('#max-kurtosis').property('value'),
        HIGHLIGHT_OUT: +d3.select('#highlight-out').property('value'),
        INIT_LEVEL_MODE: d3.select('input[name="init-level-mode"]:checked').property('value'),
        INIT_LEVEL_MANUAL: +d3.select('#init-level-manual').property('value'),
        MAX_LEVEL: defaultConfig.MAX_LEVEL,
        ALPHA_ENABLE: defaultConfig.ALPHA_ENABLE,
        SUM_PROPORTION: defaultConfig.SUM_PROPORTION,
    };

    d3.select('#l_win')
        .style('width', `${config.CANVAS_WIDTH + 2}px`)
        .style('height', `${config.CANVAS_HEIGHT + 2}px`)
        .style('margin-top', null);

    await new Promise(resolve => requestAnimationFrame(resolve));

    try {
        await runVisualization(config, dataToRender);
    } catch (error) {
        console.error("Rendering failed:", error);
        alert("Failed to render visualization. Check console for details.");
    } finally {
        d3.select('#loading-indicator').style('display', 'none');
    }
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) {
        currentData = null;
        return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            currentData = JSON.parse(e.target.result);
            const selectNode = d3.select('#dataset-select').node();
            let existingUploadedOption = selectNode.querySelector('option[value="uploaded"]');
            if (existingUploadedOption) {
                existingUploadedOption.remove();
            }
            const newOption = document.createElement('option');
            newOption.value = 'uploaded';
            newOption.textContent = `Uploaded: ${file.name}`;
            selectNode.prepend(newOption);
            selectNode.value = 'uploaded';
            console.log("File loaded and parsed successfully.");
            handleRender();
        } catch (error) {
            alert('Error parsing JSON file. Please ensure it is a valid JSON array.');
            currentData = null;
        }
    };
    reader.readAsText(file);
}

initializeUI();