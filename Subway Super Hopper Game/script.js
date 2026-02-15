import * as THREE from "three";

const CONFIG = {
	laneWidthDesktop: 2.5,
	laneWidthMobile: 2.1,
	cameraOffsetDesktop: { x: 0, y: 7, z: 10 },
	cameraOffsetMobile: { x: 0, y: 6.2, z: 11.5 },
	gravity: 0.015,
	jumpPower: 0.35,
	baseSpeed: 0.2,
	speedInc: 0.0001,
	spawnThreshold: 3,
	coinBonus: 25,
	swipeThreshold: 38
};

const MOBILE_BREAKPOINT = 768;

let state = {
	isPlaying: false,
	score: 0,
	coins: 0,
	speed: CONFIG.baseSpeed,
	lane: 0,
	currentLaneX: 0,
	isJumping: false,
	jumpVel: 0,
	playerY: 0,
	theme: null
};

const elScore = document.getElementById("score");
const elCoins = document.getElementById("coins");
const elScoreFinal = document.getElementById("final-score");
const elCoinsFinal = document.getElementById("final-coins");
const uiScore = document.getElementById("score-display");
const uiStart = document.getElementById("start-screen");
const uiGameOver = document.getElementById("game-over-screen");
const parallaxLayers = Array.from(document.querySelectorAll(".parallax-layer"));
const gameContainer = document.getElementById("game-container");

let scene;
let camera;
let renderer;
let player;
let floorGroups = [];
let worldObjects = [];
let spawnTimer = 0;
let swipeStart = null;

const THEMES = [
	{
		name: "Sky Rail",
		sky: 0x8fd3ff,
		ground: 0xf0f8ff,
		obstacle: 0xff595e,
		decor: 0x2ec4b6,
		accent: 0xff9f1c
	},
	{
		name: "Coral Rush",
		sky: 0xffd6a5,
		ground: 0xfff1e1,
		obstacle: 0xc1121f,
		decor: 0x219ebc,
		accent: 0xff9f1c
	},
	{
		name: "Blue Hour",
		sky: 0x1b2845,
		ground: 0x223a5e,
		obstacle: 0xef476f,
		decor: 0x118ab2,
		accent: 0x06d6a0
	},
	{
		name: "Mint Pop",
		sky: 0xcaf0f8,
		ground: 0xf6fff8,
		obstacle: 0xf94144,
		decor: 0x90be6d,
		accent: 0xf9c74f
	},
	{
		name: "Neon Track",
		sky: 0x101828,
		ground: 0x1f2937,
		obstacle: 0xf97316,
		decor: 0x22d3ee,
		accent: 0xa3e635
	}
];

function init() {
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(
		60,
		window.innerWidth / window.innerHeight,
		0.1,
		100
	);
	applyCameraForViewport();

	renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	gameContainer.appendChild(renderer.domElement);
	resizeRendererToContainer();

	const ambientLight = new THREE.AmbientLight(0xffffff, 0.62);
	scene.add(ambientLight);

	const dirLight = new THREE.DirectionalLight(0xffffff, 0.86);
	dirLight.position.set(10, 20, 10);
	dirLight.castShadow = true;
	dirLight.shadow.mapSize.width = 1024;
	dirLight.shadow.mapSize.height = 1024;
	scene.add(dirLight);

	renderer.render(scene, camera);

	window.addEventListener("resize", onWindowResize);
	window.addEventListener("scroll", updateParallax, { passive: true });
	document.addEventListener("keydown", handleInput);
	bindTouchControls();

	document.getElementById("start-btn").addEventListener("click", startGame);
	document.getElementById("restart-btn").addEventListener("click", startGame);

	updateParallax();
}

function applyCameraForViewport() {
	const mobile = window.innerWidth <= MOBILE_BREAKPOINT;
	const offset = mobile ? CONFIG.cameraOffsetMobile : CONFIG.cameraOffsetDesktop;
	camera.position.set(offset.x, offset.y, offset.z);
	camera.lookAt(0, 0, -5);
}

function onWindowResize() {
	applyCameraForViewport();
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	resizeRendererToContainer();
}

function resizeRendererToContainer() {
	const width = gameContainer.clientWidth || window.innerWidth;
	const height = gameContainer.clientHeight || window.innerHeight;
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	renderer.setSize(width, height, false);
}

function getLaneWidth() {
	return window.innerWidth <= MOBILE_BREAKPOINT ? CONFIG.laneWidthMobile : CONFIG.laneWidthDesktop;
}

function randomTheme() {
	return THEMES[Math.floor(Math.random() * THEMES.length)];
}

function createPlayer() {
	if (player) {
		scene.remove(player);
	}

	const group = new THREE.Group();
	const animalColors = [0xffffff, 0xc8d6e5, 0xffcda3, 0x222f3e];
	const color = animalColors[Math.floor(Math.random() * animalColors.length)];

	const mat = new THREE.MeshStandardMaterial({
		color,
		flatShading: true
	});

	const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
	body.position.y = 0.5;
	body.castShadow = true;
	group.add(body);

	const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
	const eyeGeo = new THREE.BoxGeometry(0.15, 0.15, 0.05);

	const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
	leftEye.position.set(-0.25, 0.6, 0.5);
	group.add(leftEye);

	const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
	rightEye.position.set(0.25, 0.6, 0.5);
	group.add(rightEye);

	const earType = Math.floor(Math.random() * 3);
	const earGeo =
		earType === 0
			? new THREE.BoxGeometry(0.2, 0.5, 0.2)
			: earType === 1
				? new THREE.BoxGeometry(0.3, 0.3, 0.1)
				: new THREE.ConeGeometry(0.2, 0.4, 4);

	const leftEar = new THREE.Mesh(earGeo, mat);
	leftEar.position.set(-0.3, 1.1, 0);
	leftEar.castShadow = true;
	group.add(leftEar);

	const rightEar = new THREE.Mesh(earGeo, mat);
	rightEar.position.set(0.3, 1.1, 0);
	rightEar.castShadow = true;
	group.add(rightEar);

	scene.add(group);
	return group;
}

function createObstacleMesh() {
	const type = Math.floor(Math.random() * 4);
	const geo =
		type === 0
			? new THREE.ConeGeometry(0.5, 1, 6)
			: type === 1
				? new THREE.BoxGeometry(1, 1, 1)
				: type === 2
					? new THREE.CylinderGeometry(0.5, 0.5, 1, 6)
					: new THREE.TetrahedronGeometry(0.7);

	const mat = new THREE.MeshStandardMaterial({
		color: state.theme.obstacle,
		flatShading: true
	});
	const mesh = new THREE.Mesh(geo, mat);
	mesh.castShadow = true;
	mesh.receiveShadow = true;
	mesh.userData.wobble = Math.random() > 0.64 ? (Math.random() * 0.012 + 0.01) * (Math.random() > 0.5 ? 1 : -1) : 0;
	return mesh;
}

function createDecorationMesh() {
	const group = new THREE.Group();

	const trunk = new THREE.Mesh(
		new THREE.CylinderGeometry(0.2, 0.3, 1.5, 5),
		new THREE.MeshStandardMaterial({ color: 0x5d4037, flatShading: true })
	);
	trunk.position.y = 0.75;
	trunk.castShadow = true;
	group.add(trunk);

	const leaves = new THREE.Mesh(
		new THREE.DodecahedronGeometry(0.8),
		new THREE.MeshStandardMaterial({ color: state.theme.decor, flatShading: true })
	);
	leaves.position.y = 1.8;
	leaves.castShadow = true;
	group.add(leaves);

	return group;
}

function createCoinMesh() {
	const coin = new THREE.Mesh(
		new THREE.TorusGeometry(0.34, 0.12, 10, 22),
		new THREE.MeshStandardMaterial({
			color: state.theme.accent,
			emissive: state.theme.accent,
			emissiveIntensity: 0.35,
			flatShading: true
		})
	);
	coin.rotation.x = Math.PI / 2;
	coin.castShadow = true;
	return coin;
}

function spawnRow() {
	const zStart = -60;
	const laneWidth = getLaneWidth();

	if (Math.random() > 0.3) {
		const leftDecor = createDecorationMesh();
		leftDecor.position.set(-5 - Math.random() * 5, 0, zStart);
		scene.add(leftDecor);
		worldObjects.push({ mesh: leftDecor, type: "decor" });
	}

	if (Math.random() > 0.3) {
		const rightDecor = createDecorationMesh();
		rightDecor.position.set(5 + Math.random() * 5, 0, zStart);
		scene.add(rightDecor);
		worldObjects.push({ mesh: rightDecor, type: "decor" });
	}

	if (Math.random() > 0.32) {
		const lane = Math.floor(Math.random() * 3) - 1;
		const obstacle = createObstacleMesh();
		obstacle.position.set(lane * laneWidth, 0.5, zStart);
		scene.add(obstacle);
		worldObjects.push({
			mesh: obstacle,
			type: "obstacle",
			lane,
			baseX: obstacle.position.x,
			phase: Math.random() * Math.PI * 2
		});
	}

	if (Math.random() > 0.45) {
		const coinLane = Math.floor(Math.random() * 3) - 1;
		const coin = createCoinMesh();
		coin.position.set(coinLane * laneWidth, Math.random() > 0.5 ? 1.55 : 1.05, zStart - 3.5);
		scene.add(coin);
		worldObjects.push({
			mesh: coin,
			type: "coin"
		});
	}
}

function startGame() {
	if (state.isPlaying) {
		return;
	}

	state = {
		isPlaying: true,
		score: 0,
		coins: 0,
		speed: CONFIG.baseSpeed,
		lane: 0,
		currentLaneX: 0,
		isJumping: false,
		jumpVel: 0,
		playerY: 0,
		theme: randomTheme()
	};

	spawnTimer = 0;

	uiStart.classList.add("hidden");
	uiGameOver.classList.add("hidden");
	uiScore.classList.remove("hidden");
	elScore.innerText = "0";
	elCoins.innerText = "0";

	scene.background = new THREE.Color(state.theme.sky);
	scene.fog = new THREE.Fog(state.theme.sky, 10, 52);

	floorGroups.forEach((floorItem) => scene.remove(floorItem));
	floorGroups = [];

	const floor = new THREE.Mesh(
		new THREE.PlaneGeometry(120, 240),
		new THREE.MeshStandardMaterial({
			color: state.theme.ground,
			roughness: 1,
			flatShading: true
		})
	);
	floor.rotation.x = -Math.PI / 2;
	floor.position.z = -58;
	floor.receiveShadow = true;
	scene.add(floor);
	floorGroups.push(floor);

	const grid = new THREE.GridHelper(240, 120, state.theme.decor, state.theme.decor);
	grid.position.y = 0.01;
	grid.position.z = -58;
	grid.material.opacity = 0.13;
	grid.material.transparent = true;
	scene.add(grid);
	floorGroups.push(grid);

	player = createPlayer();
	player.position.set(0, 0, 0);

	worldObjects.forEach((obj) => scene.remove(obj.mesh));
	worldObjects = [];

	animate();
}

function gameOver() {
	state.isPlaying = false;
	uiGameOver.classList.remove("hidden");
	uiScore.classList.add("hidden");
	elScoreFinal.innerText = Math.floor(state.score);
	elCoinsFinal.innerText = state.coins;
}

function moveLeft() {
	if (!state.isPlaying) {
		return;
	}
	if (state.lane > -1) {
		state.lane--;
	}
}

function moveRight() {
	if (!state.isPlaying) {
		return;
	}
	if (state.lane < 1) {
		state.lane++;
	}
}

function jump() {
	if (!state.isPlaying || state.isJumping) {
		return;
	}
	state.isJumping = true;
	state.jumpVel = CONFIG.jumpPower;
}

function handleInput(event) {
	if (!state.isPlaying) {
		if (event.code === "Space" || event.code === "Enter") {
			event.preventDefault();
			startGame();
		}
		return;
	}

	if (event.code === "ArrowLeft" || event.code === "KeyA") {
		event.preventDefault();
		moveLeft();
	} else if (event.code === "ArrowRight" || event.code === "KeyD") {
		event.preventDefault();
		moveRight();
	} else if (event.code === "ArrowUp" || event.code === "Space" || event.code === "KeyW") {
		event.preventDefault();
		jump();
	}
}

function bindTouchControls() {
	const leftBtn = document.getElementById("touch-left");
	const jumpBtn = document.getElementById("touch-jump");
	const rightBtn = document.getElementById("touch-right");
	const shell = document.getElementById("game-shell");

	const activate = (action) => (event) => {
		event.preventDefault();
		action();
	};

	[leftBtn, jumpBtn, rightBtn].forEach((btn) => {
		btn.addEventListener("touchstart", activate(btn === leftBtn ? moveLeft : btn === jumpBtn ? jump : moveRight), { passive: false });
		btn.addEventListener("mousedown", activate(btn === leftBtn ? moveLeft : btn === jumpBtn ? jump : moveRight));
	});

	shell.addEventListener(
		"touchstart",
		(event) => {
			if (!event.touches.length) {
				return;
			}
			const touch = event.touches[0];
			swipeStart = { x: touch.clientX, y: touch.clientY };
		},
		{ passive: true }
	);

	shell.addEventListener(
		"touchend",
		(event) => {
			if (!swipeStart || !event.changedTouches.length) {
				swipeStart = null;
				return;
			}

			const touch = event.changedTouches[0];
			const dx = touch.clientX - swipeStart.x;
			const dy = touch.clientY - swipeStart.y;
			swipeStart = null;

			if (!state.isPlaying) {
				return;
			}

			if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > CONFIG.swipeThreshold) {
				if (dx > 0) {
					moveRight();
				} else {
					moveLeft();
				}
			} else if (dy < -CONFIG.swipeThreshold) {
				jump();
			}
		},
		{ passive: true }
	);
}

function updateParallax() {
	const offset = window.scrollY || 0;
	parallaxLayers.forEach((layer) => {
		const depth = Number(layer.dataset.depth || 0);
		layer.style.transform = `translate3d(0, ${offset * depth}px, 0)`;
	});
}

function animate() {
	if (!state.isPlaying) {
		return;
	}

	requestAnimationFrame(animate);

	state.score += state.speed;
	state.speed += CONFIG.speedInc;
	elScore.innerText = Math.floor(state.score);

	const laneWidth = getLaneWidth();
	const targetX = state.lane * laneWidth;
	const laneDelta = targetX - state.currentLaneX;
	state.currentLaneX += laneDelta * 0.16;
	player.position.x = state.currentLaneX;

	if (state.isJumping) {
		state.playerY += state.jumpVel;
		state.jumpVel -= CONFIG.gravity;
		if (state.playerY <= 0) {
			state.playerY = 0;
			state.isJumping = false;
		}
	} else {
		state.playerY = Math.abs(Math.sin(Date.now() * 0.016)) * 0.1;
	}

	player.position.y = state.playerY + 0.5;
	player.rotation.z = THREE.MathUtils.clamp(-laneDelta * 0.09, -0.25, 0.25);
	player.rotation.x = state.isJumping ? -0.2 : 0;

	spawnTimer += state.speed;
	if (spawnTimer > CONFIG.spawnThreshold) {
		spawnRow();
		spawnTimer = 0;
	}

	for (let i = worldObjects.length - 1; i >= 0; i--) {
		const obj = worldObjects[i];
		obj.mesh.position.z += state.speed * 2;

		if (obj.type === "obstacle" && obj.mesh.userData.wobble) {
			obj.mesh.position.x = obj.baseX + Math.sin(Date.now() * obj.mesh.userData.wobble + obj.phase) * 0.18;
		}

		if (obj.type === "coin") {
			obj.mesh.rotation.y += 0.1;

			if (obj.mesh.position.z > -0.95 && obj.mesh.position.z < 0.95) {
				const dx = Math.abs(player.position.x - obj.mesh.position.x);
				const dy = Math.abs(player.position.y - obj.mesh.position.y);
				if (dx < 0.8 && dy < 0.75) {
					scene.remove(obj.mesh);
					worldObjects.splice(i, 1);
					state.coins += 1;
					state.score += CONFIG.coinBonus;
					elCoins.innerText = state.coins;
					continue;
				}
			}
		}

		if (obj.type === "obstacle") {
			if (obj.mesh.position.z > -0.8 && obj.mesh.position.z < 0.8) {
				const dx = Math.abs(player.position.x - obj.mesh.position.x);
				const dy = Math.abs(player.position.y - obj.mesh.position.y);
				if (dx < 0.8 && dy < 0.8) {
					gameOver();
				}
			}
		}

		if (obj.mesh.position.z > 10) {
			scene.remove(obj.mesh);
			worldObjects.splice(i, 1);
		}
	}

	renderer.render(scene, camera);
}

init();
