import * as THREE from 'three'
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js'

import gsap from 'gsap'

import Stats from 'stats.js'

import math from 'canvas-sketch-util/math'
import random from 'canvas-sketch-util/random'

const DEV_HELPERS = false
const DEV_WIREFRAMES = false

export default class Scene3D {
  // unique instance
  static item = null

  // mouse position
  #mouse = new THREE.Vector2(0, 0)

  // distances
  #maxDistance = this.#screenDistance()
  #distance = new THREE.Vector2(0, 0)

  // blob spring for dimension management
  #spring = {scale: 1}

  // noise ratio parameters
  #ratioScalingFactor = 0.3
  #ratioOffset = 0.8

  constructor() {
    // check previous existance of the instance
    if (Scene3D.item) {
      throw new Error('Scene3D has already been initialized')
    }

    // init stats
    this.stats = new Stats()
    this.stats.showPanel(0)
    document.body.appendChild(this.stats.dom)
    this.stats.dom.classList.add('stats')

    // initialize renderer
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      canvas: document.querySelector('canvas'),
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setClearColor(0x000000, 0) //set bg transparent

    // set shadows on renderer
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    // initialize scene
    this.scene = new THREE.Scene()

    // initialize fog
    this.scene.fog = new THREE.Fog(0xdfe7fd, 10, 1000)

    // initilaize camera
    this.camera = new THREE.PerspectiveCamera(
      100,
      window.innerWidth / window.innerHeight,
      0.1,
      10000
    )
    this.camera.position.set(0, 0, 300)

    // initialize orbit control
    // this.#createOrbitControl()

    // initialize basic helpers
    this.#createBasicHelpers()

    // initialize lights
    this.#createLights()

    // inizialize bubble
    this.#createBubble()

    // inizialize plane
    this.#createPlane()

    // add event listeners
    this.eventListeners()

    // animation loop
    this.animate()
  }

  #createOrbitControl() {
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement)
    this.orbit.update()
  }

  #createBasicHelpers() {
    if (DEV_HELPERS) {
      // axes helper
      const axesHelper = new THREE.AxesHelper(300)
      axesHelper.setColors()
      this.scene.add(axesHelper)

      // grid helper
      let gridHelper = new THREE.GridHelper(300, 300)
      this.scene.add(gridHelper)
    }
  }

  #createLights() {
    // initialize hemisphere light
    this.hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x000000, 2)
    this.scene.add(this.hemisphereLight)

    if (DEV_HELPERS) {
      const hemisphereLightHelper = new THREE.HemisphereLightHelper(
        this.hemisphereLight,
        20
      )
      this.scene.add(hemisphereLightHelper)
    }

    // initialize directional light for shadow casting
    this.shadowLight = new THREE.DirectionalLight(0xffffff, 1)
    this.shadowLight.position.set(0, 450, 350)
    this.shadowLight.castShadow = true

    // set limits for shadow casting
    this.shadowLight.shadow.camera.left = -650
    this.shadowLight.shadow.camera.right = 650
    this.shadowLight.shadow.camera.top = 650
    this.shadowLight.shadow.camera.bottom = -650
    this.shadowLight.shadow.camera.near = 1
    this.shadowLight.shadow.camera.far = 1000
    this.shadowLight.shadow.mapSize.width = 4096
    this.shadowLight.shadow.mapSize.height = 4096
    this.scene.add(this.shadowLight)

    if (DEV_HELPERS) {
      const shadowLightHelper = new THREE.DirectionalLightHelper(
        this.shadowLight,
        20,
        'black'
      )
      this.scene.add(shadowLightHelper)
    }

    // initialize other directional lights
    this.directionaLight1 = new THREE.DirectionalLight(0xc0fdff, 2)
    this.directionaLight1.position.set(-600, 350, 350)
    this.scene.add(this.directionaLight1)

    if (DEV_HELPERS) {
      const directionalLight1Helper = new THREE.DirectionalLightHelper(
        this.directionaLight1,
        20,
        'yellow'
      )
      this.scene.add(directionalLight1Helper)
    }

    this.directionaLight2 = new THREE.DirectionalLight(0xb388eb, 0.15)
    this.directionaLight2.position.set(0, -250, 300)
    this.scene.add(this.directionaLight2)

    if (DEV_HELPERS) {
      const directionalLight2Helper = new THREE.DirectionalLightHelper(
        this.directionaLight2,
        20,
        'orange'
      )
      this.scene.add(directionalLight2Helper)
    }
  }

  #createBubble() {
    // define the proper number of vertex according
    // to screen resolution
    const vertexN = window.innerWidth > 765 ? 80 : 40

    // create bubble geometry
    this.bubbleGeometry = new THREE.SphereGeometry(120, vertexN, vertexN)

    // saving original position of vertices
    this.bubbleGeometry.attributes.position.arrayOriginal = new Float32Array(
      this.bubbleGeometry.attributes.position.array
    )

    // create bubble material
    this.bubbleMaterial = new THREE.MeshStandardMaterial({
      color: 0xa3c4f3,
      emissive: 0xf1c0e8,
      emissiveIntensity: 0.4,
      metalness: 0.4,
      roughness: 1,
      side: THREE.FrontSide,
      wireframe: DEV_WIREFRAMES,
    })

    this.bubble = new THREE.Mesh(this.bubbleGeometry, this.bubbleMaterial)
    this.bubble.castShadow = true
    this.scene.add(this.bubble)
  }

  #createPlane() {
    // create plane geometry and material
    // ShadowMaterial is transparent but can receive shadows
    this.planeGeometry = new THREE.PlaneGeometry(2000, 2000)
    this.planeMaterial = new THREE.ShadowMaterial({
      opacity: 0.5,
    })
    this.plane = new THREE.Mesh(this.planeGeometry, this.planeMaterial)
    this.plane.position.set(0, -200, 0)
    this.plane.rotation.x = -90 * (Math.PI / 180) // from degrees to radiants
    this.plane.receiveShadow = true
    this.scene.add(this.plane)
  }

  #updateBubbleVertices(time) {
    // compute distancefrom mouse to the center of the screen
    this.#distance = this.#screenDistance(this.#mouse)

    // compute the relative proportion normalizing the value
    // the value is normalizedin order to have inversional proportion
    // to distortion and distance
    this.#distance /= this.#maxDistance
    this.#distance = math.mapRange(this.#distance, 1, 0, 0, 1)

    // update vertices of the sphere
    // moving three positions at time (xyz)
    for (
      let i = 0;
      i < this.bubbleGeometry.attributes.position.array.length;
      i += 3
    ) {
      // getting original cohordinates
      let x = this.bubbleGeometry.attributes.position.arrayOriginal[i]
      let y = this.bubbleGeometry.attributes.position.arrayOriginal[i + 1]
      let z = this.bubbleGeometry.attributes.position.arrayOriginal[i + 2]

      // getting perlin noise value at that specific point
      const perlin = random.noise3D(
        isFinite(x * 0.006 + time * 0.0005) ? x * 0.006 + time * 0.0005 : 0,
        isFinite(y * 0.006 + time * 0.0005) ? y * 0.006 + time * 0.0005 : 0,
        isFinite(z * 0.006 + time * 0.0005) ? z * 0.006 + time * 0.0005 : 0
      )

      // compute the ration for vertex alteration
      // inversily proportional to the distance (due to distance mapping)
      const ratio =
        this.#ratioScalingFactor * perlin * (this.#distance + 0.1) +
        this.#ratioOffset

      // set new vertex position
      this.bubbleGeometry.attributes.position.array[i] = x * ratio
      this.bubbleGeometry.attributes.position.array[i + 1] = y * ratio
      this.bubbleGeometry.attributes.position.array[i + 2] = z * ratio
    }

    // set update needed for vertices positions
    this.bubbleGeometry.attributes.position.needsUpdate = true
  }

  eventListeners() {
    // mouse movement and touch movement
    window.addEventListener('mousemove', this.mouseMove.bind(this))
    window.addEventListener('touchmove', this.mouseMove.bind(this))

    // mouse clicking or touch screen
    window.addEventListener('mousedown', this.mouseClickDown.bind(this))
    window.addEventListener('touchstart', this.mouseClickDown.bind(this))
    window.addEventListener('mouseup', this.mouseClickUp.bind(this))
    window.addEventListener('touchend', this.mouseClickUp.bind(this))

    // resize
    window.addEventListener('resize', this.resize.bind(this))
  }

  mouseMove(event) {
    // interpolate mouse movement
    gsap.to(this.#mouse, {
      duration: 0.8,
      x:
        event.clientX ||
        event.pageX ||
        (event.touches ? event.touches[0].pageX : 0),
      y:
        event.clientY ||
        event.pageY ||
        (event.touches ? event.touches[0].pageY : 0),
      ease: 'power2.out',
    })
  }

  mouseClickDown() {
    // interpolating scale parameter
    gsap.to(this.#spring, {
      duration: 0.7,
      scale: 0.7,
      ease: 'power3.out',
    })
  }

  mouseClickUp() {
    // interpolating scale parameter
    gsap.to(this.#spring, {
      duration: 0.9,
      scale: 1,
      ease: 'elastic.out(1,0.3)',
    })
  }

  animate(time) {
    requestAnimationFrame((time) => this.animate(time))

    this.stats.begin()

    // update bubble rotation
    this.bubble.rotation.y =
      -4 * math.mapRange(this.#mouse.x, 0, window.innerWidth, 0, 4)
    this.bubble.rotation.z =
      4 * math.mapRange(this.#mouse.x, 0, window.innerWidth, 0, -4)

    // update bubble scaling
    this.bubble.scale.set(
      this.#spring.scale,
      this.#spring.scale,
      this.#spring.scale
    )

    // update bubble distortion
    this.#updateBubbleVertices(time)

    // clear buffer and render the scene
    this.renderer.clear()
    this.renderer.render(this.scene, this.camera)

    this.stats.end()
  }

  resize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.#maxDistance = this.#screenDistance()
  }

  #computeDistance(a, b) {
    const dx = a.x - b.x
    const dy = a.y - b.y
    const d = Math.sqrt(dx * dx + dy * dy)
    return d
  }

  // compute the distance from the mouse to the center
  // of the screen
  #screenDistance(vec2 = new THREE.Vector2(0, 0)) {
    return this.#computeDistance(vec2, {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    })
  }

  static init() {
    if (!Scene3D.item) {
      Scene3D.item = new Scene3D()
    }
  }
}
