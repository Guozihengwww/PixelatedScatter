import os
from flask import Flask, render_template, redirect, url_for, request, jsonify
from os import path
import pandas as pd
import numpy as np
import json

root = r'static/data/scatterplots'
app = Flask(__name__)


@app.route('/')
def hello_world():
    return redirect(url_for('index'))


@app.route('/index')
def index():
    return render_template('index.html')


@app.route('/kurtosis_using_median', methods=['POST'])
def kurtosis_using_median():
    kurtosis_threshold = float(request.form['kurtosis_threshold'])
    num_list = eval(request.form['num_list'])
    print(kurtosis_threshold, num_list)

    def calculate_kurtosis(cluster_data):
        median = np.median(cluster_data)
        std_dev = np.sqrt(np.mean((cluster_data - median) ** 2))
        if std_dev == 0:
            return 0
        z_scores = (cluster_data - median) / std_dev
        return np.mean(z_scores ** 4) - 3

    clusters_under_threshold = []
    for idx, cluster in enumerate(num_list):
        if len(cluster) == 1:
            clusters_under_threshold.append(idx)
        kurtosis = calculate_kurtosis(np.array(cluster))
        if kurtosis <= kurtosis_threshold:
            clusters_under_threshold.append(idx)

    # 返回符合条件的cluster索引
    return jsonify(clusters_under_threshold)


@app.route('/read_data', methods=['POST'])
def read_data():
    filepath = path.join(root, str(request.form['data_name']))
    with open(filepath, 'r') as file:
        return json.dumps(json.load(file))


@app.route('/save_points', methods=['POST'])
def save_points():
    data_name = str(request.form['data_name'])
    results = eval(request.form['results'].replace('null', 'None'))
    method = str(request.form['method'])
    size = str(request.form['size'])

    save_path = os.path.join('static/data/' + method, size, data_name + '.json')
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    with open(save_path, 'w') as fw:
        json.dump(results, fw)
    return json.dumps({})


@app.route('/update_visual_map', methods=['POST'])
def update_visual_map():
    data_name = str(request.form['data_name'])
    method = str(request.form['method'])
    size = str(request.form['size'])
    visual_map_data = eval(request.form['results'].replace('null', 'None'))['visualMap']

    file_path = os.path.join('static/data', method, size, data_name + '.json')
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, 'r', encoding='utf-8') as f_read:
        existing_data = json.load(f_read)

    existing_data['visualMap'] = visual_map_data

    with open(file_path, 'w') as f_write:
        json.dump(existing_data, f_write)
    return json.dumps({})


if __name__ == '__main__':
    app.run(debug=True, port=6010)
