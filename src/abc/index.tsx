import React, { FC, useCallback, useEffect, useRef } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
// import styles from '../index.module.less';
import { DataTexture, RGBAFormat, PlaneGeometry, MeshBasicMaterial, Mesh, Vector3, Box3 } from 'three';
import h377 from 'heatmap.js';
import * as THREE from 'three';
import useLilGui from './use-lil-gui';
import Heatmap from './Heatmap';
import { data } from './data.tsx';

import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import { v4 as uuidv4 } from 'uuid';

// 场景
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xF2F6F8);
// 渲染器
const renderer = new THREE.WebGLRenderer({ alpha: true });
renderer.shadowMap.enabled = true;
// 正投影 相机
const camera = new THREE.OrthographicCamera(window.innerWidth / -2, window.innerWidth / 2, window.innerHeight / 2, window.innerHeight / -2, 1, 1000);
// 环境光
let ambient = new THREE.AmbientLight(0xF2F6F8, 0.5);
scene.add(ambient);
// 方向光
const directionalLight = new THREE.DirectionalLight(0xffffff);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0;
directionalLight.shadow.camera.far = 1000;
directionalLight.shadow.normalBias = 0.05;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
directionalLight.position.set(-200, 200, 200);
scene.add(directionalLight);

// CSS2D 渲染器对象
const css2DRenderer = new CSS2DRenderer();
css2DRenderer.setSize(window.innerWidth, window.innerHeight);
css2DRenderer.render(scene, camera);
css2DRenderer.domElement.style.position = "absolute";
css2DRenderer.domElement.style.top = '0';
css2DRenderer.domElement.style.pointerEvents = 'none';
window.document.body.appendChild(css2DRenderer.domElement);

const gltfLoader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('/draco/');
gltfLoader.setDRACOLoader(dracoLoader);
let floorMesh = [];
let wallMesh = [];
let areaMeshes = [];
gltfLoader.load('./yuhang.glb', (glb: any) => {

  floorMesh = [];
  wallMesh = [];
  glb.scene.children.forEach((item: THREE.Object3D) => {
    item.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (child.name == 'Floor') {
          child.material = new THREE.MeshLambertMaterial({
            color: 0xCECCCC,
          });
          child.receiveShadow = true;
          floorMesh.push(child);

        } else {
          child.material = new THREE.MeshLambertMaterial({ color: 0xffffff });
          child.receiveShadow = true;
          child.castShadow = true;
          wallMesh.push(child);
        }
      }
    });
    // debugger

  });
  scene.add(glb.scene);
  // // 归一化
  const box = new THREE.Box3().setFromObject(glb.scene);
  const size = box.getSize(new THREE.Vector3()).length();
  const center = box.getCenter(new THREE.Vector3());
  glb.scene.position.sub(center);
  glb.scene.position.y = 0;
  // glb.scene.scale.set(1 / size, 1 / size, 1 / size);
  glb.scene.updateMatrixWorld();


  initHeatmap()

  initArea()

});

// 坐标轴助手
// const axes = new THREE.AxesHelper(6);
// scene.add(axes);
// // // 网格助手
// const gridHelper = new THREE.GridHelper(10, 10);
// gridHelper.rotateX(Math.PI);
// scene.add(gridHelper);
// 轨道控制器
const controls = new OrbitControls(camera, renderer.domElement);


interface IPoint {
  x: number
  y: number
  value: number
}

let heatMap: Heatmap | null = null
let heatMin = 0
let heatMax = 40

function initHeatmap() {
  heatMap = new Heatmap()
  const dataList: IPoint[] = []
  data.pixels.map((p) => {
    if (p?.value) {
      dataList.push({
        value: p?.value,
        x: (p.pt.y - 60) / 170,
        y: -(p.pt.x - 55) / 160,
      })
    }
  })

  heatMap.init(scene, scene)
  heatMap.setData(dataList)
  heatMap.setVisible(true)
}
function updateHeatmap() {
  if (heatMap) {
      heatMap.setMinMax(heatMin, heatMax);
  }
}
function initArea() {
  const w = data.cad_wh.col
  const h = data.cad_wh.row

  data.list.map((area) => {
    const vertexs = []
    area.area_pts.map((p) => {
      // @ts-ignore 
      vertexs.push({
        x: (p.y - h / 2) / h * 23 - 1,
        y: (p.x - w / 2) / w * 24.5,
      })
    })
    const mesh = drawArea(area.area_name, vertexs);
    areaMeshes.push(mesh);
  })
}
function drawArea(name: string, points: any[]) {
  const shape = new THREE.Shape();
  if (points.length < 2) return
  let centroidX = 0, centroidY = 0;
  for (const point of points) {
    centroidX += point.x;
    centroidY += point.y;
  }
  centroidX /= points.length;
  centroidY /= points.length;

  shape.moveTo(points[0].x - centroidX, points[0].y - centroidY);
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x - centroidX, points[i].y - centroidY);
  }
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  const material = new THREE.MeshBasicMaterial({ color: 0x000055, opacity: 0.5, transparent: true });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(centroidX, 0.01, -centroidY);
  mesh.rotation.x = -Math.PI * 0.5;
  const Aid = 'area' + uuidv4();
  mesh.name = Aid;
  drawAreaLabel(Aid, name, mesh)
  scene.add(mesh);
  return mesh;
}

function drawAreaLabel(id, text, obj) {
  const label = document.createElement('div');
  label.id = id;
  label.className = 'area-label';
  label.style.color = '#000';
  label.style.background = '#fff';
  label.style.position = 'absolute';
  label.style.fontSize = '20px';
  label.style.padding = '4px 8px';
  label.textContent = text;
  label.style.pointerEvents = 'auto'
  label.style.visibility = 'hidden';
  const labelObject = new CSS2DObject(label);
  document.body.appendChild(label);
  obj.add(labelObject);

}
var raycaster = new THREE.Raycaster();
var mouse = new THREE.Vector2();
function onDocumentMouseMove(event) {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  var intersects = raycaster.intersectObjects(scene.children);
  if (intersects.length > 0) {
    const labels = document.getElementsByClassName('area-label');
    [...labels].forEach(label => {
      (label as HTMLElement).style.visibility = 'hidden';
    })
    for (let i = 0; i < intersects.length; i++) {
      if (intersects[i].object.name.includes('area')) {
        const areaLabel = document.getElementById(intersects[i].object.name);
        areaLabel && (areaLabel.style.visibility = 'visible');
        return

      }
    }
  }
}

document.addEventListener('mousemove', onDocumentMouseMove, false);
const ABC: FC = () => {
  const threeRef = useRef<HTMLDivElement>(null);
  const [isload, guiEntity, destroyEntity] = useLilGui('Modify Model Parameters');
  const timer = useRef<number>(0);
  const initSize = useCallback(() => {
    const _threeRef = threeRef.current;
    let width = _threeRef?.offsetWidth || 0;

    let height = _threeRef?.offsetHeight || 0;
    let aspect = width / height;
    let frustrum = 10;
    let pixelRatio = Math.min(window.devicePixelRatio, 3);
    camera.left = (-aspect * frustrum) / 2;
    camera.right = (aspect * frustrum) / 2;
    camera.top = frustrum / 2;
    camera.bottom = -frustrum / 2;
    camera.position.set(-20, 4, 0);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    renderer.setPixelRatio(pixelRatio);
  }, []);

  type GUIParams = {

    lightIndex: number;

    shadowColor: string;        // Color of the shadow
    shadowBias: number;         // Add shadow bias
    shadowCameraNear: number;  // Add shadow near plane
    shadowCameraFar: number;   // Add shadow far plane

    lightColor: string;          // Color of the light
    lightIntensity: number;      // Intensity of the light
    lightPositionX: number;      // Light position x coordinate
    lightPositionY: number;      // Light position y coordinate
    lightPositionZ: number;      // Light position z coordinate
    ambientColor: string;        // Color of ambient light
    ambientIntensity: number;     // Intensity of ambient light
    floorColor: string;          // Color of the floor
    floorMaterialType: string;   // Material type for the floor (e.g., "MeshLambertMaterial", "MeshPhongMaterial")
    wallColor: string;           // Color of the walls
    wallMaterialType: string;    // Material type for the walls
    cameraPositionX: number;     // Camera position x coordinate
    cameraPositionY: number;     // Camera position y coordinate
    cameraPositionZ: number;     // Camera position z coordinate
    enableHeatMap: boolean;       // Toggle for heatmap
    enableArea: boolean;          // Toggle for area

    areaColor: string;                 // Color of the area
    areaPositionX: number;             // Area position X coordinate
    areaPositionY: number;             // Area position Y coordinate
    areaPositionZ: number;             // Area position Z coordinate
    areaMaterialType: string;          // Material type for the area
    areaTransparency: number;           // Transparency of the area
    areaEmissiveColor: string;         // Emissive color for the area
    areaRoughness: number;             // Roughness of the area material
    areaMetalness: number;             // Metalness of the area material

    floorPositionX: number;            // Floor position X coordinate
    floorPositionY: number;            // Floor position Y coordinate
    floorPositionZ: number;            // Floor position Z coordinate
    floorTransparency: number;          // Transparency of the floor
    floorEmissiveColor: string;        // Emissive color for the floor
    floorRoughness: number;            // Roughness of the floor material
    floorMetalness: number;            // Metalness of the floor material

    wallPositionX: number;             // Wall position X coordinate
    wallPositionY: number;             // Wall position Y coordinate
    wallPositionZ: number;             // Wall position Z coordinate
    wallTransparency: number;           // Transparency of the wall
    wallEmissiveColor: string;         // Emissive color for the wall
    wallRoughness: number;             // Roughness of the wall material
    wallMetalness: number;             // Metalness of the wall material
    heatMin: number;  // Minimum heat value
    heatMax: number;  // Maximum heat value
  };

  const guiParams: GUIParams = {
    lightIndex: 0.5,
    shadowBias: 0.05,          // Default value for shadow bias
    shadowCameraNear: 0,      // Default value for shadow camera near plane
    shadowCameraFar: 1000,    // Default value for shadow camera far plane
    shadowColor: '#000000',

    lightColor: '#ffffff',
    lightIntensity: 1.0,
    lightPositionX: -200,
    lightPositionY: 200,
    lightPositionZ: 200,
    ambientColor: '#F2F6F8',
    ambientIntensity: 0.5,
    floorColor: '#CECCCC',
    floorMaterialType: 'MeshLambertMaterial',
    wallColor: '#ffffff',
    wallMaterialType: 'MeshLambertMaterial',
    cameraPositionX: -20,
    cameraPositionY: 4,
    cameraPositionZ: 0,
    enableHeatMap: true,
    enableArea: true,

    areaColor: '#F2F6F8',              // Default color for the area
    areaPositionX: 0,                  // Default position X
    areaPositionY: 0,                  // Default position Y
    areaPositionZ: 0,                  // Default position Z
    areaMaterialType: 'MeshBasicMaterial',   // Default material type
    areaTransparency: 1.0,              // Default opacity (1.0 = fully opaque)
    areaEmissiveColor: '#000000',      // Default emissive color
    areaRoughness: 0.5,                 // Default roughness
    areaMetalness: 0.0,                 // Default metalness

    floorPositionX: 0,                  // Default position X for the floor
    floorPositionY: 0,                  // Default position Y for the floor
    floorPositionZ: 0,                  // Default position Z for the floor
    floorTransparency: 1.0,              // Default opacity for the floor
    floorEmissiveColor: '#000000',     // Default emissive color for the floor
    floorRoughness: 0.5,                // Default roughness for the floor
    floorMetalness: 0.0,                // Default metalness for the floor

    wallPositionX: 0,                   // Default position X for walls
    wallPositionY: 0,                   // Default position Y for walls
    wallPositionZ: 0,                   // Default position Z for walls
    wallTransparency: 1.0,              // Default opacity for walls
    wallEmissiveColor: '#000000',       // Default emissive color for walls
    wallRoughness: 0.5,                 // Default roughness for walls
    wallMetalness: 0.0,                 // Default metalness for walls
    heatMin: 0,       // Default minimum heat value
    heatMax: 40,      // Default maximum heat value
  };
  // 添加 Gui 调参可选项
  const addParametersForGui = useCallback(() => {
    const togglesFolder = guiEntity.addFolder('Toggles');
    togglesFolder
      ?.add(guiParams, 'enableHeatMap')
      .onChange((val: boolean) => {
        if (val) {
          heatMap.setVisible(true); 
        } else {
          heatMap.setVisible(false); 
        }
      });
    togglesFolder
      ?.add(guiParams, 'enableArea')
      .onChange((val: boolean) => {
        areaMeshes.forEach(mesh => {
          mesh.visible = val; 
        });
      });
      
    const heatmapFolder = guiEntity.addFolder('Heatmap');
      heatmapFolder
          ?.add(guiParams, 'heatMin')
          .min(0)
          .max(100)
          .step(1)
          .onFinishChange((val) => {
              heatMin = val; // Update the heatMin
              // You might want to refresh or update heatmap rendering logic here if necessary
              updateHeatmap();
          });
      
      heatmapFolder
          ?.add(guiParams, 'heatMax')
          .min(0)
          .max(100)
          .step(1)
          .onFinishChange((val) => {
              heatMax = val; // Update the heatMax
              // Similarly refresh or update heatmap rendering logic
              updateHeatmap();
          });
    // Add shadow parameters
    const shadowFolder = guiEntity.addFolder('Shadow');
    shadowFolder
      ?.add(guiParams, 'shadowBias')
      .min(0)
      .max(0.1)
      .step(0.01)
      .onFinishChange((val: number) => {
        directionalLight.shadow.normalBias = val;
      });

    shadowFolder
      ?.add(guiParams, 'shadowCameraNear')
      .min(0)
      .max(100)
      .step(1)
      .onFinishChange((val: number) => {
        directionalLight.shadow.camera.near = val;
        directionalLight.shadow.camera.updateProjectionMatrix();
      });

    shadowFolder
      ?.add(guiParams, 'shadowCameraFar')
      .min(100)
      .max(2000)
      .step(10)
      .onFinishChange((val: number) => {
        directionalLight.shadow.camera.far = val;
        directionalLight.shadow.camera.updateProjectionMatrix();
      });

    const lightFolder = guiEntity.addFolder('Light');
    lightFolder
      ?.addColor(guiParams, 'lightColor')
      .onFinishChange((val) => {
        directionalLight.color.set(val);
      });
    lightFolder
      ?.add(guiParams, 'lightIntensity')
      .min(0)
      .max(5)
      .step(0.1)
      .onFinishChange((val: number) => {
        directionalLight.intensity = val;
      });
    lightFolder
      ?.add(guiParams, 'lightPositionX')
      .min(-500)
      .max(500)
      .step(1)
      .onFinishChange((val: number) => {
        directionalLight.position.x = val;
      });
    lightFolder
      ?.add(guiParams, 'lightPositionY')
      .min(0)
      .max(500)
      .step(1)
      .onFinishChange((val: number) => {
        directionalLight.position.y = val;
      });
    lightFolder
      ?.add(guiParams, 'lightPositionZ')
      .min(-500)
      .max(500)
      .step(1)
      .onFinishChange((val: number) => {
        directionalLight.position.z = val;
      });
    const ambientFolder = guiEntity.addFolder('Ambient Light');
    ambientFolder
      ?.addColor(guiParams, 'ambientColor')
      .onFinishChange((val) => {
        ambient.color.set(val);
      });
    ambientFolder
      ?.add(guiParams, 'ambientIntensity')
      .min(0)
      .max(1)
      .step(0.1)
      .onFinishChange((val: number) => {
        ambient.intensity = val;
      });

    const floorFolder = guiEntity.addFolder('Floor');
    floorFolder
      ?.addColor(guiParams, 'floorColor')
      .onFinishChange((val) => {
        if (floorMesh.length > 0) {
          floorMesh.map((mesh) => {
            mesh.material.color.set(val);
          })
        }
      });

    floorFolder
      ?.add(guiParams, 'floorPositionX')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        floorMesh.forEach((mesh) => {
          mesh.position.x = val; 
        });
      });
    floorFolder
      ?.add(guiParams, 'floorPositionY')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        floorMesh.forEach((mesh) => {
          mesh.position.y = val; 
        });
      });
    floorFolder
      ?.add(guiParams, 'floorPositionZ')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        floorMesh.forEach((mesh) => {
          mesh.position.z = val;
        });
      });
    floorFolder
      ?.add(guiParams, 'floorMaterialType', ['MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial'])
      .onFinishChange((val) => {
        floorMesh.forEach((mesh) => {
          let newMaterial;

          if (val === 'MeshPhongMaterial') {
            newMaterial = new THREE.MeshPhongMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.floorTransparency,
              emissive: new THREE.Color(guiParams.floorEmissiveColor),
              roughness: guiParams.floorRoughness,
              metalness: guiParams.floorMetalness,
            });
          } else if (val === 'MeshLambertMaterial') {
            newMaterial = new THREE.MeshLambertMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.floorTransparency,
              emissive: new THREE.Color(guiParams.floorEmissiveColor),
            });
          } else {
            newMaterial = new THREE.MeshBasicMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.floorTransparency,
            });
          }
          mesh.material = newMaterial;
          mesh.needsUpdate = true;
        });
      });
    floorFolder
      ?.add(guiParams, 'floorTransparency')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        floorMesh.forEach((mesh) => {
          mesh.material.opacity = val;
          mesh.material.transparent = val < 1;
        });
      });
    floorFolder
      ?.addColor(guiParams, 'floorEmissiveColor')
      .onFinishChange((val) => {
        floorMesh.forEach((mesh) => {
          mesh.material.emissive.set(val);
        });
      });
    floorFolder
      ?.add(guiParams, 'floorRoughness')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        floorMesh.forEach((mesh) => {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.roughness = val;
          }
        });
      });
    floorFolder
      ?.add(guiParams, 'floorMetalness')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        floorMesh.forEach((mesh) => {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.metalness = val;
          }
        });
      });

    const wallFolder = guiEntity.addFolder('Wall');
    wallFolder
      ?.addColor(guiParams, 'wallColor')
      .onFinishChange((val) => {
        if (wallMesh.length > 0) {
          wallMesh.map((mesh) => {
            mesh.material.color.set(val);
          })
        }
      });
    wallFolder
      ?.add(guiParams, 'wallPositionX')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        wallMesh.forEach((mesh) => {
          mesh.position.x = val;
        });
      });
    wallFolder
      ?.add(guiParams, 'wallPositionY')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        wallMesh.forEach((mesh) => {
          mesh.position.y = val;
        });
      });
    wallFolder
      ?.add(guiParams, 'wallPositionZ')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        wallMesh.forEach((mesh) => {
          mesh.position.z = val;
        });
      });
    wallFolder
      ?.add(guiParams, 'wallMaterialType', ['MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial'])
      .onFinishChange((val) => {
        wallMesh.forEach((mesh) => {
          let newMaterial;

          if (val === 'MeshPhongMaterial') {
            newMaterial = new THREE.MeshPhongMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.wallTransparency,
              emissive: new THREE.Color(guiParams.wallEmissiveColor),
              roughness: guiParams.wallRoughness,
              metalness: guiParams.wallMetalness,
            });
          } else if (val === 'MeshLambertMaterial') {
            newMaterial = new THREE.MeshLambertMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.wallTransparency,
              emissive: new THREE.Color(guiParams.wallEmissiveColor),
            });
          } else {
            newMaterial = new THREE.MeshBasicMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.wallTransparency,
            });
          }
          mesh.material = newMaterial;
          mesh.needsUpdate = true;
        });
      });
    wallFolder
      ?.add(guiParams, 'wallTransparency')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        wallMesh.forEach((mesh) => {
          mesh.material.opacity = val;
          mesh.material.transparent = val < 1;
        });
      });
    wallFolder
      ?.addColor(guiParams, 'wallEmissiveColor')
      .onFinishChange((val) => {
        wallMesh.forEach((mesh) => {
          mesh.material.emissive.set(val);
        });
      });
    wallFolder
      ?.add(guiParams, 'wallRoughness')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        wallMesh.forEach((mesh) => {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.roughness = val;
          }
        });
      });
    wallFolder
      ?.add(guiParams, 'wallMetalness')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        wallMesh.forEach((mesh) => {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.metalness = val;
          }
        });
      });

    const cameraFolder = guiEntity.addFolder('Camera');
    cameraFolder
      ?.add(guiParams, 'cameraPositionX')
      .min(-500)
      .max(500)
      .step(1)
      .onFinishChange((val: number) => {
        camera.position.x = val;
        camera.updateProjectionMatrix();
      });
    cameraFolder
      ?.add(guiParams, 'cameraPositionY')
      .min(0)
      .max(500)
      .step(1)
      .onFinishChange((val: number) => {
        camera.position.y = val;
      });
    cameraFolder
      ?.add(guiParams, 'cameraPositionZ')
      .min(-500)
      .max(500)
      .step(1)
      .onFinishChange((val: number) => {
        camera.position.z = val;
      });

    
    const areaFolder = guiEntity.addFolder('Area');
    areaFolder
      ?.addColor(guiParams, 'areaColor')
      .onFinishChange((val) => {
        areaMeshes.forEach(mesh => {
          mesh.material.color.set(val); 
        });
      });
    areaFolder
      ?.add(guiParams, 'areaPositionX')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        areaMeshes.forEach(mesh => {
          mesh.position.x = val; 
        });
      });
    areaFolder
      ?.add(guiParams, 'areaPositionY')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        areaMeshes.forEach(mesh => {
          mesh.position.y = val; 
        });
      });
    areaFolder
      ?.add(guiParams, 'areaPositionZ')
      .min(-500).max(500).step(1)
      .onFinishChange((val: number) => {
        areaMeshes.forEach(mesh => {
          mesh.position.z = val; 
        });
      });
    areaFolder
      ?.add(guiParams, 'areaMaterialType', ['MeshBasicMaterial', 'MeshLambertMaterial', 'MeshPhongMaterial'])
      .onFinishChange((val) => {
        areaMeshes.forEach(mesh => {
          let newMaterial;

          if (val === 'MeshPhongMaterial') {
            newMaterial = new THREE.MeshPhongMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.areaTransparency,
              emissive: new THREE.Color(guiParams.areaEmissiveColor),
              roughness: guiParams.areaRoughness,
              metalness: guiParams.areaMetalness
            });
          } else if (val === 'MeshLambertMaterial') {
            newMaterial = new THREE.MeshLambertMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.areaTransparency,
              emissive: new THREE.Color(guiParams.areaEmissiveColor)
            });
          } else {
            newMaterial = new THREE.MeshBasicMaterial({
              color: mesh.material.color,
              transparent: true,
              opacity: guiParams.areaTransparency
            });
          }

          mesh.material = newMaterial; 
          mesh.needsUpdate = true; 
        });
      });
    areaFolder
      ?.add(guiParams, 'areaTransparency')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        areaMeshes.forEach(mesh => {
          mesh.material.opacity = val; 
          mesh.material.transparent = val < 1; 
        });
      });
    areaFolder
      ?.addColor(guiParams, 'areaEmissiveColor')
      .onFinishChange((val) => {
        areaMeshes.forEach(mesh => {
          mesh.material.emissive.set(val); 
        });
      });
    areaFolder
      ?.add(guiParams, 'areaRoughness')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        areaMeshes.forEach(mesh => {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.roughness = val; 
          }
        });
      });
    areaFolder
      ?.add(guiParams, 'areaMetalness')
      .min(0).max(1).step(0.01)
      .onFinishChange((val: number) => {
        areaMeshes.forEach(mesh => {
          if (mesh.material instanceof THREE.MeshStandardMaterial) {
            mesh.material.metalness = val; 
          }
        });
      });
      
  }, [guiEntity]);

  useEffect(() => {
    if (!isload) return;
    addParametersForGui();
    return () => {
      // 销毁 Gui 实例
      destroyEntity();
    };
  }, [addParametersForGui, destroyEntity, isload]);

  const animate = useCallback(() => {
    timer.current = requestAnimationFrame(() => {
      controls.update();
      renderer.render(scene, camera);
      css2DRenderer.render(scene, camera)
      animate();
    });
  }, []);


  useEffect(() => {
    initSize();
    if (threeRef.current) {
      threeRef.current.appendChild(renderer.domElement);
    }
    animate();
    return () => {
      cancelAnimationFrame(timer.current);
    };
  }, [animate, initSize]);

  return <div style={{ width: '100%', height: '100%' }} ref={threeRef} />;
};

export default ABC;
