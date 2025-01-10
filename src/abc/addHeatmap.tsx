import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import * as h337 from 'heatmap.js'

import { vertexShader, fragmentShader } from './glsl';

const addHeatmap = (scene, containerId) => {
  const heatmapRef = useRef(null);
  const greymapRef = useRef(null);
  const heatMapPlaneRef = useRef(null);
  const container = document.createElement('div')
  container.style.width = `1024px`
  container.style.height = `1024px`
  container.style.display = 'none'
  container.className = 'heatmap-container'

  document.body.appendChild(container)
  useEffect(() => {
    const radius = 10;

    const heatmap = h337.create({
      container: document.querySelector('.heatmap-container'),
      gradient: {
        0.5: '#1fc2e1',
        0.6: '#24d560',
        0.7: '#9cd522',
        0.8: '#f1e12a',
        0.9: '#ffbf3a',
        1.0: '#ff0000',
      },
      radius: radius,
      maxOpacity: 1,
    });

    const greymap = h337.create({
      container: document.querySelector('.heatmap-container'),
      gradient: {
        0: 'black',
        '1.0': 'white',
      },
      radius: radius,
      maxOpacity: 1,
    });

    // Store references for later usage
    // @ts-ignore 
    heatmapRef.current = heatmap;
    // @ts-ignore 

    greymapRef.current = greymap;

    const initMesh = () => {
      const geometry = new THREE.PlaneGeometry(100, 100, 300, 300);
      const material = new THREE.ShaderMaterial({
        transparent: true,
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms: {
          heatMap: { value: { value: undefined } },
          greyMap: { value: { value: undefined } },
          Zscale: { value: 4.0 },
          u_color: { value: new THREE.Color('rgb(255, 255, 255)') },
          u_opacity: { value: 1.0 },
        },
      });

    // @ts-ignore 
      const heatMapPlane = new THREE.Mesh(geometry, material);
    // @ts-ignore 
      heatMapPlane.position.set(0, 0, 4);
      scene.add(heatMapPlane);

    // @ts-ignore 
      heatMapPlaneRef.current = heatMapPlane;
    };

    initMesh();

    return () => {
      // Cleanup if needed
      if (heatMapPlaneRef.current) {
        scene.remove(heatMapPlaneRef.current);
      }
    };
  }, [scene, containerId]);

  const setHeatData = (points, projection) => {
    const transformedPoints = points.map((point) => {
      const [x, y] = projection([point[1], point[0]]);
      return { x: Math.floor(x * 5 + 250), y: Math.floor(y * 5 + 250), value: point[2] };
    });

    const max = 30000;
    const min = 0;

    // @ts-ignore 
    heatmapRef.current.setData({
      max,
      min,
      data: transformedPoints,
    });
    // @ts-ignore 
    greymapRef.current.setData({
      max,
      min,
      data: transformedPoints,
    });

    // @ts-ignore 
    let texture = new THREE.Texture(heatmapRef.current._config.container.children[0]);
    texture.needsUpdate = true;
    // @ts-ignore 
    let texture2 = new THREE.Texture(greymapRef.current._config.container.children[0]);
    texture2.needsUpdate = true;

    // @ts-ignore 
    heatMapPlaneRef.current.material.uniforms.heatMap.value = texture;
    // @ts-ignore 
    heatMapPlaneRef.current.material.side = THREE.DoubleSide; // 双面渲染
    // @ts-ignore 
    heatMapPlaneRef.current.material.uniforms.greyMap.value = texture2;
  };

  // return { setHeatData };
};

export default addHeatmap;
