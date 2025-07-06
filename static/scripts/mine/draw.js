import * as THREE from '../library/three.module.js';

function pixel_render(canvasElement, initialData) {
    const camera = new THREE.PerspectiveCamera(90, 1, 1, 100000);
    const scene = new THREE.Scene();
    scene.add(camera);

    const renderer = new THREE.WebGLRenderer({antialias: false, canvas: canvasElement, alpha: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearAlpha(0);

    // This function is ONLY called programmatically to set the renderer size.
    function handleResize() {
        const width = canvasElement.width;
        const height = canvasElement.height;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.position.x = width / 2;
        camera.position.y = height / 2;
        camera.position.z = height / Math.exp(1);
        camera.fov = needed_fov(height, camera.position.z, 1);
        camera.updateProjectionMatrix();
    }

    const vertexShader = `
        attribute vec3 customColor;
        varying vec3 vColor;
        attribute float alpha;
        varying float vAlpha;
        void main() {
            vColor = customColor;
            vAlpha = alpha;
            vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
            gl_Position = projectionMatrix * mvPosition;
            gl_PointSize = 1.0;
        }
    `;
    const fragmentShader = `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
            gl_FragColor = vec4(vColor, vAlpha);
        }
    `;

    const geometry = new THREE.BufferGeometry();
    const material = new THREE.ShaderMaterial({
        vertexShader: vertexShader, fragmentShader: fragmentShader, transparent: true, vertexColors: true
    });
    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let opacities = [];

    function updateData(newData) {
        let vertices = [], colors = [];
        newData.forEach(e => {
            e.x += 0.5;
            e.y += 0.5;
            e.z = 0;
        });

        if (newData.length !== opacities.length) {
            opacities = [];
            for (let i = 0; i < newData.length; i++) {
                vertices.push(newData[i].x, newData[i].y, newData[i].z);
                colors.push(newData[i].R / 255, newData[i].G / 255, newData[i].B / 255);
                opacities.push(newData[i].hasOwnProperty('alpha') ? newData[i].alpha : 1);
            }
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('customColor', new THREE.Float32BufferAttribute(colors, 3));
            geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(opacities, 1));
        } else {
            const posAttr = geometry.attributes.position.array;
            const colorAttr = geometry.attributes.customColor.array;
            const alphaAttr = geometry.attributes.alpha.array;
            for (let i = 0; i < newData.length; i++) {
                posAttr[i * 3] = newData[i].x;
                posAttr[i * 3 + 1] = newData[i].y;
                posAttr[i * 3 + 2] = newData[i].z;
                colorAttr[i * 3] = newData[i].R / 255;
                colorAttr[i * 3 + 1] = newData[i].G / 255;
                colorAttr[i * 3 + 2] = newData[i].B / 255;
                alphaAttr[i] = newData[i].hasOwnProperty('alpha') ? newData[i].alpha : 1;
            }
            geometry.attributes.position.needsUpdate = true;
            geometry.attributes.customColor.needsUpdate = true;
            geometry.attributes.alpha.needsUpdate = true;
        }
    }

    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }

    function needed_fov(h, camera_z, scale) {
        const fov_height = h / scale;
        const half_fov_radians = Math.atan(fov_height / (2 * camera_z));
        return half_fov_radians * (180 / Math.PI) * 2;
    }

    handleResize(); // Initial setup call
    updateData(initialData);
    animate();

    return {
        updateData: updateData, resize: handleResize
    };
}

export {pixel_render};