# app.py

import os
from flask import Flask, render_template, redirect, url_for, request, jsonify
from os import path
import json

# Define the root directory for datasets
DATA_ROOT = path.join('static', 'data', 'scatterplots')

app = Flask(__name__)
# Ensure the data directory exists
os.makedirs(DATA_ROOT, exist_ok=True)


@app.route('/')
def root():
    """Redirects the root URL to the main index page."""
    return redirect(url_for('index'))


@app.route('/index')
def index():
    """Renders the main application page."""
    return render_template('index.html')


@app.route('/datasets', methods=['GET'])
def get_datasets():
    """Returns a list of available .json dataset filenames from the data directory."""
    try:
        files = [f for f in os.listdir(DATA_ROOT) if f.endswith('.json')]
        return jsonify(files)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/read_data', methods=['POST'])
def read_data():
    """Reads and returns the content of a specific dataset file."""
    data_name = request.form.get('data_name')
    if not data_name:
        return jsonify({"error": "data_name is required"}), 400

    # Basic security check to prevent directory traversal attacks
    if '..' in data_name or data_name.startswith('/'):
        return jsonify({"error": "Invalid data_name"}), 400

    filepath = path.join(DATA_ROOT, data_name)

    if not path.exists(filepath):
        return jsonify({"error": "File not found"}), 404

    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            data = json.load(file)
        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=6010)
