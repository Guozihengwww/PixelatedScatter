const select_div_height = 40;
const _svg_width = 900;
const _svg_height = 900;
const _left_padding = 30;
const _right_padding = 70;
const _bottom_padding = 80;
const _top_padding = 80;
const _curve_g_height = _svg_height - _bottom_padding - _top_padding;
const _curve_g_width = _svg_width - _left_padding - _right_padding;
const _k_x = 0;
const canvas_width = 900;
const canvas_height = 900;
const scale = window.devicePixelRatio < 2 ? Math.sqrt(3 - window.devicePixelRatio) : 1;

const line = d3.line();
const percentage_format = d3.format(".1%");
const format = d3.format(".3f");

const board = d3.select('body')
    .append('div')
    .attr('id', 'board')
    .style('width', '100%')
    .style('border', '3px solid #CBCBCBFF')
    .style('padding', '8px')
    .style('background-color', '#f8f6f6')

const plot_div = board.append('div')
    .attr('id', 'plot_div')
    .style('display', 'flex')
    .style('justify-content', 'center')
    .style('width', '100%')
//.style('height', div_height + 'px');

const l_win = plot_div.append('div')
    .attr('id', 'l_win')
    .style('width', canvas_width + 4 + 'px')
    .style('height', canvas_height + 4 + 'px')
    .style('border', '2px solid #888')
    .style('background-color', 'white')
    .style('position', 'relative');

const canvas = l_win.append('canvas')
    .attr('id', 'my_canvas')
    .attr('width', $('#l_win').width())
    .attr('height', $('#l_win').height())
    .style('background-color', 'white')
    .style('position', 'absolute');

const font_awesome_svg = l_win.append('svg')
    .attr('id', 'font_awesome_svg')
    .attr('width', $('#l_win').width() * 0.18)
    .attr('height', $('#l_win').width() * 0.1)
    .attr('transform', `translate(${$('#l_win').width() * 0.8}, ${$('#l_win').height() * 0.0125})`)
    .style('position', 'absolute');

const control_div = plot_div.append('div')
    .attr('id', 'control_div')
    .style('width', $('#plot_div').width() * 45 / 100 + 'px')
    .style('height', $('#plot_div').height() + 'px')
    .style('margin-left', '2%')

const parameter_div = control_div.append('div')
    .attr('id', 'parameter_div')
    .style('width', '100%')
    .style('height', '25%')
    .style('background', "#ffffff")
    .style('border', '3px dashed #888')
    .style('border-radius', '1.5%');


const div_origin = control_div.append('div')
    .attr('id', 'origin_div')
    .style('border', '2px solid #888')
    .style('margin-top', '20px')
    .style('display', 'flex')
    .style('flex-direction', 'column')
    .style('width', '100%')
    .style('height', `calc(100% - ${0.25 * 100}% - 20px)`)
    .style('background', "#ececec")

div_origin.append('svg')
    .attr('id', 'origin_svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .style('background-color', '#b0b0b0');