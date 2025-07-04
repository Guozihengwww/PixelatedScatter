import * as THREE from '../library/three.module.js';

function pixel_render(data) {
    const board = document.getElementById('board');

    const {width, height} = board.getElementsByTagName('canvas')[0].getBoundingClientRect();

    const camera = new THREE.PerspectiveCamera(90, width / height, 1, 100000);
    camera.position.x = width / 2;
    camera.position.y = height / 2;
    camera.position.z = height / (exp(1));
    camera.fov = needed_fov(height, camera.position.z, 1);
    camera.updateProjectionMatrix();
    const scene = new THREE.Scene();
    // scene.background = new THREE.Color('#000000');
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({antialias: false, canvas: canvas.node(), alpha: true});
    renderer.setSize(width, height);
    renderer.setPixelRatio(devicePixelRatio);
    renderer.setClearAlpha(0);
    window.addEventListener('resize', onWindowResize);

    const vertexShader = `
        attribute vec3 customColor;  // Rename "color" to "customColor" to avoid conflicts
        varying vec3 vColor;
        attribute float alpha;
        varying float vAlpha;
    
        void main() {
            vColor = customColor;   // Use the new name here
            vAlpha = alpha;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = 1.0;
        }
    `;

    const fragmentShader = `
        //uniform sampler2D pointTexture;
        varying vec3 vColor;
        varying float vAlpha;
    
        void main() {
            // vec4 texColor = texture2D(pointTexture, gl_PointCoord);
            // if (texColor.a < 0.5) discard;
    
            gl_FragColor = vec4(vColor, vAlpha);
        }
    `;

    // geometry and material
    const geometry = new THREE.BufferGeometry();
    let vertices = [], colors = [], opacities = [];
    updateData(data);

    // const textureLoader = new THREE.TextureLoader();
    // const sprite = textureLoader.load('../static/texture/pixelTexture.png', (texture) => {
    //     texture.transparent = true;
    // });
    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShader, fragmentShader: fragmentShader, transparent: true, vertexColors: true
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    function onWindowResize() {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height);
    }

    function needed_fov(height, camera_z, scale) {
        const fov_height = height / scale
        const half_fov_radians = atan(fov_height / (2 * camera_z))
        const half_fov = half_fov_radians * (180 / PI)
        return half_fov * 2;
    }

    function updateData(newData) {
        newData.forEach(function (e) {
            e.x += 0.5;
            e.y += 0.5;
            e.z = 0;
        });

        if (newData.length !== opacities.length) {
            vertices = [];
            colors = [];
            opacities = [];

            for (let i = 0; i < newData.length; i++) {
                vertices.push(newData[i].x)
                vertices.push(newData[i].y)
                vertices.push(newData[i].z)

                colors.push(newData[i].R / 255, newData[i].G / 255, newData[i].B / 255);
                opacities.push(newData[i].hasOwnProperty('alpha') ? newData[i].alpha : 1);
            }

            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('customColor', new THREE.Float32BufferAttribute(colors, 3));
            geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(opacities, 1));

            return;
        }

        for (let i = 0; i < newData.length; i++) {
            vertices[i * 3] = newData[i].x;
            vertices[i * 3 + 1] = newData[i].y;
            vertices[i * 3 + 2] = newData[i].z;

            colors[i * 3] = newData[i].R / 255;
            colors[i * 3 + 1] = newData[i].G / 255;
            colors[i * 3 + 2] = newData[i].B / 255;

            // initial opacities
            opacities[i] = newData[i].hasOwnProperty('alpha') ? newData[i].alpha : 1;
        }

        geometry.attributes.position.array = new Float32Array(vertices);
        geometry.attributes.position.needsUpdate = true;
        geometry.attributes.customColor.array = new Float32Array(colors);
        geometry.attributes.customColor.needsUpdate = true;
        geometry.attributes.alpha.array = new Float32Array(opacities);
        geometry.attributes.alpha.needsUpdate = true;
    }

    animate();
    onWindowResize();

    return {
        updateData: updateData
    };
}

export {pixel_render}