/*
 * Copyright 2021 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Query for WebXR support. If there's no support for the `immersive-ar` mode,
 * show an error.
 */
(async function () {
	const isArSessionSupported =
		navigator.xr &&
		navigator.xr.isSessionSupported &&
		await navigator.xr.isSessionSupported("immersive-ar");
	if (isArSessionSupported) {
		document.getElementById("enter-ar").addEventListener("click", window.app.activateXR)
	} else {
		onNoXRDevice();
	}
})();

/**
 * Container class to manage connecting to the WebXR Device API
 * and handle rendering on every frame.
 */
class App {
	/**
	 * Run when the Start AR button is pressed.
	 */
	activateXR = async () => {
		try {
			/** Initialize a WebXR session using "immersive-ar". */
			// this.xrSession = await navigator.xr.requestSession("immersive-ar");
			/** Alternatively, initialize a WebXR session using extra required features. */
			this.xrSession = await navigator.xr.requestSession("immersive-ar", {
				requiredFeatures: ['hit-test', 'dom-overlay'],
				domOverlay: { root: document.body }
			});

			
			document.getElementById("stabilization").style.removeProperty("display");
			document.getElementById("enter-ar-info").style.removeProperty("display");
			document.getElementById("unsupported-info").style.removeProperty("display");

			/** Create the canvas that will contain our camera's background and our virtual scene. */
			this.createXRCanvas();

			/** With everything set up, start the app. */
			await this.onSessionStarted();
		} catch (e) {
			console.log(e);
			onNoXRDevice();
		}
	}

	/**
	 * Add a canvas element and initialize a WebGL context that is compatible with WebXR.
	 */
	createXRCanvas() {
		this.canvas = document.createElement("canvas");
		document.body.appendChild(this.canvas);
		this.gl = this.canvas.getContext("webgl", { xrCompatible: true });

		this.xrSession.updateRenderState({
			baseLayer: new XRWebGLLayer(this.xrSession, this.gl)
		});
	}

	/**
	 * Called when the XRSession has begun. Here we set up our three.js
	 * renderer, scene, and camera and attach our XRWebGLLayer to the
	 * XRSession and kick off the render loop.
	 */
	onSessionStarted = async () => {
		/** Add the `ar` class to our body, which will hide our 2D components. */
		document.body.classList.add('ar');

		/** To help with working with 3D on the web, we'll use three.js. */
		this.setupThreeJs();

		/** Setup an XRReferenceSpace using the "local" coordinate system. */
		this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');

		/** Create another XRReferenceSpace that has the viewer as the origin. */
		this.viewerSpace = await this.xrSession.requestReferenceSpace('viewer');

		/** Perform hit testing using the viewer as origin. */
		this.hitTestSource = await this.xrSession.requestHitTestSource({ space: this.viewerSpace });

		/** Start a rendering loop using this.onXRFrame. */
		this.xrSession.requestAnimationFrame(this.onXRFrame);

		this.xrSession.addEventListener("select", this.onSelect);
		document.body.addEventListener("touchstart", this.onTouchStart);
		document.body.addEventListener("touchend", this.onTouchEnd);
		document.body.addEventListener("touchmove", this.onTouchMove);
		this.getURLParameter("model");

		this.button.style.display = "inline-block";
	}

	/**
	 * Called on the XRSession's requestAnimationFrame.
	 * Called with the time and XRPresentationFrame.
	 */
	onXRFrame = (time, frame) => {
		/** Queue up the next draw request. */
		this.xrSession.requestAnimationFrame(this.onXRFrame);

		/** Bind the graphics framebuffer to the baseLayer's framebuffer. */
		const framebuffer = this.xrSession.renderState.baseLayer.framebuffer
		this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
		this.renderer.setFramebuffer(framebuffer);

		/** Retrieve the pose of the device.
		 * XRFrame.getViewerPose can return null while the session attempts to establish tracking. */
		const pose = frame.getViewerPose(this.localReferenceSpace);
		if (pose) {
			/** In mobile AR, we only have one view. */
			const view = pose.views[0];

			const viewport = this.xrSession.renderState.baseLayer.getViewport(view);
			this.renderer.setSize(viewport.width, viewport.height)

			/** Use the view's transform matrix and projection matrix to configure the THREE.camera. */
			this.camera.matrix.fromArray(view.transform.matrix)
			this.camera.projectionMatrix.fromArray(view.projectionMatrix);
			this.camera.updateMatrixWorld(true);

			/** Conduct hit test. */
			const hitTestResults = frame.getHitTestResults(this.hitTestSource);

			/** If we have results, consider the environment stabilized. */
			if (!this.stabilized && hitTestResults.length > 0) {
				this.stabilized = true;
				document.body.classList.add('stabilized');
			}
			if (hitTestResults.length > 0) {
				const hitPose = hitTestResults[0].getPose(this.localReferenceSpace);

				this.reticlePlaced = true;

				/** Update the reticle position. */
				this.reticle.visible = true;
				this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
				this.reticle.updateMatrixWorld(true);
			}
			/** Render the scene with THREE.WebGLRenderer. */
			this.renderer.render(this.scene, this.camera)
		}
	}

	/**
	 * Initialize three.js specific rendering code, including a WebGLRenderer,
	 * a demo scene, and a camera for viewing the 3D content.
	 */
	setupThreeJs() {
		/** To help with working with 3D on the web, we'll use three.js.
		 * Set up the WebGLRenderer, which handles rendering to our session's base layer. */
		this.renderer = new THREE.WebGLRenderer({
			alpha: true,
			preserveDrawingBuffer: true,
			canvas: this.canvas,
			context: this.gl
		});
		this.renderer.autoClear = false;
		this.renderer.shadowMap.enabled = true;
		this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

		/** Initialize our demo scene. */
		// this.scene = DemoUtils.createCubeScene();
		this.scene = DemoUtils.createLitScene();
		this.reticle = new Reticle();
		this.scene.add(this.reticle);

		/** We'll update the camera matrices directly from API, so
		 * disable matrix auto updates so three.js doesn't attempt
		 * to handle the matrices independently. */
		this.camera = new THREE.PerspectiveCamera();
		this.camera.matrixAutoUpdate = false;
	}

	/** Place a sunflower when the screen is tapped. */
	onSelect = () => {
		if (window.sunflower) {
			if (this.isObjectSpawned == true || this.reticlePlaced == false)
				return;
			// const clone = window.sunflower.clone();
			// clone.position.copy(this.reticle.position);
			// this.scene.add(clone);

			this.scene.remove(this.reticle);
			this.object.position.copy(this.reticle.position);
			this.scene.add(this.object);
			this.isObjectSpawned = true;

			// const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
			// shadowMesh.position.y = clone.position.y;
		}
	}

	constructor() {
		this.isObjectSpawned = false;
		this.object = undefined;
		this.touched = false;
		this.difference = new THREE.Vector2();
		this.lastTouch = new THREE.Vector2();
		this.firstValue = new THREE.Vector2();
		this.secondValue = new THREE.Vector2();
		this.lastScaleDifference = 0;
		this.scaleDifference = 0;
		this.objModel = undefined;
		this.reticlePlaced = false;

		this.button = document.getElementById("backButton");
		this.button.onclick = () => {
			console.log("lol");
			console.log(this.xrSession);
			this.xrSession.end();
			this.isObjectSpawned = false;
			this.reticlePlaced = false;
			this.stabilized = false;
			document.body.classList.remove('stabilized');
			document.getElementById("stabilization").style.display = "none";
			document.getElementById("enter-ar-info").style.display = "flex";
			document.getElementById("unsupported-info").style.display = "none";
			document.getElementById("backButton").style.display = "none";
		}
	}

	onTouchStart = (event) => {
		if (this.object == undefined) {
			return;
		}
		this.touched = true;

		var firstTouch = event.touches[0];
		this.lastTouch.x = (firstTouch.clientX / window.innerWidth) * 2 - 1;
		this.lastTouch.y = (firstTouch.clientY / window.innerHeight);

		if (event.touches.length > 1) {
			var firstTouch = event.touches[0];
			var secondTouch = event.touches[1];

			this.firstValue.x = (firstTouch.clientX / window.innerWidth) * 2 - 1;
			this.firstValue.y = (firstTouch.clientY / window.innerHeight);

			this.secondValue.x = (secondTouch.clientX / window.innerWidth) * 2 - 1;
			this.secondValue.y = (secondTouch.clientY / window.innerHeight);

			this.lastScaleDifference = this.firstValue.distanceTo(this.secondValue);
		}
	}

	onTouchEnd = (event) => {
		if (this.object == undefined) {
			return;
		}
		this.touched = false;
	}

	onTouchMove = (event) => {
		if (this.object == undefined) {
			return;
		}
		var firstTouch = event.touches[0];
		var pinching = false;

		if (event.touches.length > 1) {
			pinching = true;
			var secondTouch = event.touches[1];
			this.secondValue.x = (secondTouch.clientX / window.innerWidth) * 2 - 1;
			this.secondValue.y = (secondTouch.clientY / window.innerHeight);
		}

		this.firstValue.x = (firstTouch.clientX / window.innerWidth) * 2 - 1;
		this.firstValue.y = (firstTouch.clientY / window.innerHeight);

		if (pinching == false) {
			this.difference.x = this.firstValue.x - this.lastTouch.x;
			this.difference.y = this.firstValue.y - this.lastTouch.y;

			this.lastTouch.x = this.firstValue.x;
			this.lastTouch.y = this.firstValue.y;

			this.object.rotation.y += this.difference.x * 2;
		}
		else {
			this.scaleDifference = this.firstValue.distanceTo(this.secondValue);

			var difference = this.scaleDifference - this.lastScaleDifference;
			var scaleRate = 1;
			this.object.scale.x += difference * scaleRate;
			this.object.scale.y += difference * scaleRate;
			this.object.scale.z += difference * scaleRate;

			this.lastScaleDifference = this.scaleDifference
		}
	}

	getURLParameter = (sParam) => {
		// console.log(parameter);
		var sPageURL = window.location.search.substring(1);
		var sURLVariables = sPageURL.split('&');
		for (var i = 0; i < sURLVariables.length; i++) {
			var sParameterName = sURLVariables[i].split('=');
			if (sParameterName[0] == sParam) {
				console.log(sParameterName[1]);
				const objectGltf = gltfLoader.load(sParameterName[1], (model) => this.modelLoaded(model), undefined,
					function (error) {
						console.error(error);
					});
			}
		}
	}

	modelLoaded = (model) => {
		console.log(model.scene);
		this.objModel = model.scene;
		this.objModel.scale.set(0.1, 0.1, 0.1);
		this.objModel.position.set(0, 0, 0);

		var box = new THREE.Box3().setFromObject(this.objModel);
		box.getCenter(this.objModel.position);
		this.objModel.position.multiplyScalar(- 1);

		this.object = new THREE.Group();
		this.object.add(this.objModel);
	}
}


window.app = new App();
