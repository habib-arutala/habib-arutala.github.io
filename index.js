//init scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe0e0e0);

//init camera
const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.z = 5;
camera.position.y = 0;

//init renderer
const renderer = new THREE.WebGLRenderer();

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const container = document.getElementById("canvas-container");
var canvasHeight = container.clientHeight;
var canvasWidth = container.clientWidth;
renderer.setSize(
    canvasWidth,
    canvasHeight
);
container.appendChild(renderer.domElement);

//Create a DirectionalLight and turn on shadows for the light
const light = new THREE.DirectionalLight(0xffffff, 1, 1);
light.position.set(0, 1, 0);
light.castShadow = true;
light.shadow.mapSize.width = 512;
light.shadow.mapSize.height = 512;
light.shadow.camera.near = 0.5;
light.shadow.camera.far = 500;
scene.add(light);

//Create ambient Light
const ambientLight = new THREE.AmbientLight(0x404040, 1);
scene.add(ambientLight);

//object loader init
var objModel = undefined;
var pivot = undefined;
const gltfLoader = new THREE.GLTFLoader();
var autoRotate = true;
var waitAutoRotate = false;
var autoRotateTimeOut = 100;
var aRCounter = 0;

//mouse events
var mouse = new THREE.Vector2();
var lastMouse = new THREE.Vector2();
var difference = new THREE.Vector2();
var basicScale = new THREE.Vector3();
basicScale.x = 1;
basicScale.y = 1;
basicScale.z = 1;
var isMouseDown = false;
function onMouseMove(event) {
    if (isMouseDown != true)
        return;
    if (pivot == undefined)
        return;

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    difference.x = mouse.x - lastMouse.x;
    difference.y = mouse.y - lastMouse.y;

    lastMouse.x = mouse.x;
    lastMouse.y = mouse.y;

    pivot.rotation.y += difference.x * 2;
    pivot.rotation.x -= difference.y;

    if (pivot.rotation.x > 1)
        pivot.rotation.x = 1;
    else if (pivot.rotation.x < -1)
        pivot.rotation.x = -1;
}

function onMouseDown(event) {
    isMouseDown = true;
    lastMouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    lastMouse.y = - (event.clientY / window.innerHeight) * 2 + 1;
    autoRotate = false;
    waitAutoRotate = false;
}

function onMouseUp(event) {
    isMouseDown = false;
    waitAutoRotate = true;
}

function onWheel(event) {
    if (pivot == undefined)
        return;

    var value = event.deltaY / -1000;
    var scale = pivot.scale.x
    if (scale + value <= 0.1)
        return;
    pivot.scale.x += value;
    pivot.scale.y += value;
    pivot.scale.z += value;
}

//update frame
function Update() {
    requestAnimationFrame(Update);

    if (pivot != undefined) {
        camera.lookAt(pivot.position);
        if (autoRotate) {
            pivot.rotation.y += 0.05;
        }
    }

    if (!waitAutoRotate) {
        aRCounter = 0;
    }
    else {
        aRCounter += 1;
        if (aRCounter >= autoRotateTimeOut) {
            autoRotate = true;
            waitAutoRotate = false;
        }
    }

    renderer.render(scene, camera);
}
Update();

//get model url
function GetURLParameter(sParam) {
    // console.log(parameter);
    var sPageURL = window.location.search.substring(1);
    var sURLVariables = sPageURL.split('&');
    for (var i = 0; i < sURLVariables.length; i++) {
        var sParameterName = sURLVariables[i].split('=');
        if (sParameterName[0] == sParam) {
            const objectGltf = gltfLoader.load(sParameterName[1], function (model) {
                objModel = model.scene;
                objModel.scale.set(1, 1, 1);
                objModel.position.set(0, 0, 0);
                objModel.castShadow = true;
                objModel.receiveShadow = true;

                var box = new THREE.Box3().setFromObject(objModel);
                box.getCenter(objModel.position);
                objModel.position.multiplyScalar(- 1);

                pivot = new THREE.Group();
                scene.add(pivot);
                pivot.add(objModel);
                // scene.add(objModel);
            }, undefined, function (error) {

                console.error(error);
            });
        }
    }
}
GetURLParameter("model");

var slider = document.getElementById("scale-slider");
slider.addEventListener('input', scaleUpdate)

function scaleUpdate(event) {
    if (pivot != undefined) {
        var value = slider.value / 100;
        pivot.scale.x = basicScale.x + value;
        pivot.scale.y = basicScale.y + value;
        pivot.scale.z = basicScale.z + value;
    }
}

// function touchMove(event) {
//     if (isMouseDown != true)
//         return;
//     if (pivot == undefined)
//         return;

//     var touches = event.changedTouches;

//     mouse.x = (touches[0].clientX / window.innerWidth) * 2 - 1;
//     mouse.y = - (touches[0].clientY / window.innerHeight) * 2 + 1;

//     difference.x = mouse.x - lastMouse.x;
//     difference.y = mouse.y - lastMouse.y;

//     lastMouse.x = mouse.x;
//     lastMouse.y = mouse.y;

//     console.log(mouse);

//     pivot.rotation.y += difference.x * 2;
//     pivot.rotation.x -= difference.y;

//     if (pivot.rotation.x > 1)
//         pivot.rotation.x = 1;
//     else if (pivot.rotation.x < -1)
//         pivot.rotation.x = -1;
// }

// function touchStart(event) {
//     isMouseDown = true;
//     var touches = event.changedTouches;
//     lastMouse.x = (touches[0].clientX / window.innerWidth) * 2 - 1;
//     lastMouse.y = - (touches[0].clientY / window.innerHeight) * 2 + 1;
//     autoRotate = false;
//     waitAutoRotate = false;
// }

// function touchEnd(event) {
//     isMouseDown = false;
//     waitAutoRotate = true;
// }

container.addEventListener('mousemove', onMouseMove, false);
container.addEventListener('mousedown', onMouseDown, false);
container.addEventListener('mouseup', onMouseUp, false);
// container.addEventListener('touchmove', touchMove, false);
// container.addEventListener('touchstart', touchStart, false);
// container.addEventListener('touchend', touchEnd, false);
container.addEventListener('wheel', onWheel, false);