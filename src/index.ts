import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Vector2, Quaternion } from "@babylonjs/core/Maths/math";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Mesh } from "@babylonjs/core/Meshes";
import { StandardMaterial } from "@babylonjs/core/Materials";
import { Texture, CubeTexture, VideoTexture } from "@babylonjs/core/Materials/Textures";
import "@babylonjs/core/Helpers/sceneHelpers";
import "@babylonjs/core/Materials/standardMaterial";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { WaterMaterial } from "@babylonjs/materials/water";
import { WebXRFeaturesManager } from "@babylonjs/core/XR/webXRFeaturesManager";
// Required side effects to populate the Create methods on the mesh class. Without this, the bundle would be smaller but the createXXX methods from mesh would not be accessible.
import {MeshBuilder} from  "@babylonjs/core/Meshes/meshBuilder";
import { WebXRDefaultExperience } from "@babylonjs/core/XR/webXRDefaultExperience";
import { WebXRCamera, WebXRControllerComponent, WebXRInputSource, WebXRState} from "@babylonjs/core/XR";
import { ActionManager } from "@babylonjs/core/Actions/actionManager";
import { ExecuteCodeAction } from "@babylonjs/core/Actions";
import * as GUI from 'babylonjs-gui';
import { GradientMaterial } from "@babylonjs/materials";
import { AssetsManager } from "@babylonjs/core";
import { particlesPixelShader } from "@babylonjs/core/Shaders/particles.fragment";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; // Get the canvas element 
const engine = new Engine(canvas, true); // Generate the BABYLON 3D engine
const screens: Mesh[] = new Array();
// Paddle Related things
let paddleCenter: Vector3 = new Vector3(0, 3, 3);
let leftController: WebXRInputSource;
let rightController: WebXRInputSource;
let projectedScale: number = .5;
let lefthand: Mesh;
let righthand: Mesh;
// Globals for Tracking Paddle Movement
let delay: number = 0;
let prevLeft: Vector3 = new Vector3(0,0,0);//[] = new Array(10);
let prevRight: Vector3 = new Vector3(0,0,0);//[] = new Array(10);
let leftBlade: Mesh;
let rightBlade: Mesh;
let playerAcceleration: Vector3 = new Vector3(0,0,0);
let rotAcc: number = 0;
let playerCam: WebXRCamera;
let forwardDir: Vector3 = new Vector3(0,0,1);

//StateManager
var stateManager = {
    controllersReady: false,
    projectPaddle: false,
    instructionsVisible: true
}
//variables for Ducklings
let maxDucks = 15;
let leftDucks: Mesh[] = new Array(maxDucks);
let rightDucks: Mesh[] = new Array(maxDucks);
let nextDuckIdx = 0;
let counter = 0;
let maxCounter = 1;
let resetCounter = 0;

let paddle: Mesh;

/**
 * This is what sets the paddles position to the hand controllers
 * unfortuantely sometimes the scene doesnt register a mesh
 * for the motion controllers so we have to do math to figure it out
 */
const calibrateControllers = function() {
    
    let left: Vector3 = leftController!.grip!.getAbsolutePosition().clone();//.scale(1/numIters);
    let right: Vector3 = rightController!.grip!.getAbsolutePosition().clone();//.scale(1/numIters);
    // Will use this for forwardDir
    paddleCenter = Vector3.Center(left, right);
    // If we are projecting just add the scaled forward
    if (stateManager.projectPaddle) {
        resetCounter = 0;
        paddleCenter.addInPlace(forwardDir.scale(projectedScale));
        left.addInPlace(forwardDir.scale(projectedScale))
        right.addInPlace(forwardDir.scale(projectedScale))
        if (counter > maxCounter) {
            counter = 0;
            leftDucks[nextDuckIdx].position = left.clone();
            rightDucks[nextDuckIdx].position = right.clone();
            nextDuckIdx = (nextDuckIdx+1) % maxDucks;
        } else {
            counter++;        
        }
    } else if (resetCounter < maxDucks) {
        resetCounter++;
        leftDucks[nextDuckIdx].position = new Vector3(0, -10, 0);
        rightDucks[nextDuckIdx].position = new Vector3(0, -10, 0);
        nextDuckIdx = (nextDuckIdx+1) % maxDucks; 
    }
    paddle.position = paddleCenter;
    var dx = paddleCenter.x - left.x;
    var len = left.subtract(right).length();
    var dy = right.y - left.y;
    var dz = left.z - paddleCenter.z;
    // let temp = Quaternion.RotationAxis(forwardDir, Math.atan(dy/dx) + Math.PI/2).toEulerAngles()
    paddle.rotation.y = Math.atan(dz/dx)
    if (right.x < left.x) {
        paddle.rotation.z = Math.PI/2 + Math.atan(dy/-len);
    } else {
        paddle.rotation.z = Math.PI/2 + Math.atan(dy/len);
    }   
    lefthand.position = left
    righthand.position = right
    
}

/** 
 * The meat of our logic. This manages the speed and speed changes of the user
 * It also vibrates the controller
 */
const updateSpeeds = function() {
    // If the user has stated they are ready
    if (stateManager.controllersReady) {
        // Orient paddle to fit their hands
        calibrateControllers();
        // Need this to be defined first
        if (playerCam != undefined) {
            // Project the camera to floor
            let hips: Vector3 = (playerCam as WebXRCamera).position.clone()
            hips.y = 0
            //If projecting need to rotate about this point
            if (stateManager.projectPaddle) {
                hips.addInPlace(forwardDir.scale(projectedScale))
            }
            // Tried doing collision detection became buggy after being in scene too long
            if (leftBlade.getAbsolutePosition().y < .6) {
                // dont want to start immediately
                delay++;
                // Where are we currently
                let contactPoint: Vector3 = leftBlade.getAbsolutePosition().clone();
                // Need to make sure we dont accidentally add vertical velocity
                contactPoint.y = 0;
                // Hips to paddle
                let contactVec: Vector3 = hips.subtract(contactPoint);
                if (delay > 5) {
                    // Velocity of the paddle blade
                    let leftVel = contactPoint.subtract(prevLeft);
                    //Vibrate the controller based on speed
                    leftController.motionController!.pulse(Math.min(leftVel.length()*20, 1), 1);
                    // The further away the paddle is the more rotation there should be
                    let ratio = Math.min(contactVec.length()/.95, 1);
                    // How much of our velocity is in the correct direction
                    let dot = Vector3.Dot(leftVel.scale(ratio), forwardDir)
                    if (rightController.grip!.position.x > leftController.grip!.position.x ) {
                        rotAcc -= dot;
                    } else { 
                        rotAcc += dot;
                    }
                    leftVel.scaleInPlace(1-ratio);
                    // only add that velocity that is in the forward direction
                    let change = forwardDir.scale(Vector3.Dot(leftVel, forwardDir));
                    // We need to move opposite of the paddle
                    playerAcceleration.addInPlace(change.negate());
                }
            // again, detecting collisions failed after a while
            } else if (rightBlade.getAbsolutePosition().y < .6) {
                delay++;
                //Where are we
                let contactPoint: Vector3 = rightBlade.getAbsolutePosition().clone();
                contactPoint.y = 0;
                // Hips->Paddle
                let contactVec: Vector3 = hips.subtract(contactPoint);
                if (delay > 5) {
                    //Get paddle blade velocity
                    let rightVel = contactPoint.subtract(prevRight);
                    //Virbate the controller based on speed
                    rightController.motionController!.pulse(Math.min(rightVel.length()*20, 1), 1);
                    // Change velcoity into angular vel depending on how far away
                    let ratio = Math.min(contactVec.length()/.95, 1);
                    //How much is in line with forward
                    let dot = Vector3.Dot(rightVel.scale(ratio), forwardDir);
                    // since we are on right, we add the dot product
                    if (rightController.grip!.position.x > leftController.grip!.position.x ) {
                        rotAcc += dot;
                    } else {
                        rotAcc -= dot;
                    }
                    
                    rightVel.scaleInPlace(1-ratio);
                    //only want the forward
                    let change = forwardDir.scale(Vector3.Dot(rightVel, forwardDir));
                    // opposite of paddle vel
                    playerAcceleration.addInPlace(change.negate());
                }
            } else {
                // with none in the water, reset delay
                delay = 0;
                
            }
            
        }
        
        // Linearly decrease angular velocity
        rotAcc*=.98
        
        //Capping the movement speed
        //If the controller becomes lost it can accidentally give insane velocities
        if (rotAcc > 0) {
            rotAcc = Math.min(rotAcc, 1)
        } else {
            rotAcc = Math.max(rotAcc, -1)
        }
        if (playerAcceleration.length() > 2) {
            //Cap velocity
            playerAcceleration.scaleInPlace(2/playerAcceleration.length());
        } else {
            // linearly decrease speed
            playerAcceleration.scaleInPlace(.995);
        }
        //keep track of paddle position
        prevLeft = leftBlade.getAbsolutePosition().clone();
        prevLeft.y = 0;
        prevRight = rightBlade.getAbsolutePosition().clone();
        prevRight.y = 0;
    }
}

/***
 * This creates the paddle in the environment.
 * It is initially hidden below the map
 * @param   {Scene} scene       Scene to render against
 */
const createPaddle = function(scene: Scene) {
    paddle = Mesh.CreateCylinder('paddle', 1.97, .05, .05, 24, 1, scene, true)
    let paddleMat = new StandardMaterial('paddleMat', scene);
    paddleMat.diffuseColor = new Color3(0, .05, .1);
    paddleMat.ambientColor = new Color3(1,1,1);
    paddle.material = paddleMat;
    paddle.position = new Vector3(0, -1, 0);
    
    let bladeMat = new GradientMaterial('paddleMat', scene)
    bladeMat.topColor = new Color3(1, 1, .3)
    bladeMat.bottomColor = new Color3(1, .25, .1)

    leftBlade = MeshBuilder.CreateBox('leftBlade', {
        width: .23,
        height: .55,
        depth: .01
    })
    leftBlade.position = paddle.position.add(new Vector3(0, .89, 0));
    leftBlade.material = bladeMat.clone('leftBladeMat')
    paddle.addChild(leftBlade);
    
    
    rightBlade = MeshBuilder.CreateBox('rightBlade', {
        width: .23,
        height: .55,
        depth: .01
    })
    rightBlade.position = paddle.position.add(new Vector3(0, -.89, 0));
    rightBlade.material = bladeMat.clone('rightBladeMat')
    paddle.addChild(rightBlade)
    lefthand = MeshBuilder.CreateSphere('leftH', {
        diameter: .1
    })    
    var leftMat = new StandardMaterial('leftMat', scene);
    leftMat.diffuseColor = new Color3(.4, 0, 0.13);
    lefthand.material = leftMat;
    lefthand.position = paddle.position.clone()
    
    righthand = MeshBuilder.CreateSphere('leftH', {
        diameter: .1
    })    
    var rightMat = new StandardMaterial('leftMat', scene);
    rightMat.diffuseColor = new Color3(.4, 0, .13);
    righthand.material = rightMat;
    righthand.position = paddle.position.clone()
    
    //Initialize the ducks before so that we are moving them around later
    //rather than crating them anew every tie. Commonly used in shooters for bullets
    for (var i =0; i<maxDucks; i++) {
        let newLeftDuck = MeshBuilder.CreateSphere('lDuck'+i, {diameter:.03})
        let newLMat = new StandardMaterial('lDuckMat' +i , scene);
        newLMat.diffuseColor = new Color3(.3, 0, .05)
        newLeftDuck.position = lefthand.position.clone()
        newLeftDuck.material = newLMat
        let newRightDuck = MeshBuilder.CreateSphere('rDuck'+i, {diameter:.03})
        let newRMat = new StandardMaterial('rDuckMat' +i , scene);
        newRMat.diffuseColor = new Color3(.3, 0, .05)
        newRightDuck.position = righthand.position.clone()
        newRightDuck.material = newRMat
        leftDucks[i] = newLeftDuck;
        rightDucks[i] = newRightDuck
    }
    
}

/**
 * This creates a video on a pillar in the scene
 * @param videoName The name of the video file
 * @param pos Where should this pillar be created
 * @param scene scene to render against
 * @param rotAmount How much should we rotate around the origin
 * @param around what point should we rotate around. Default is (0,1,0)
 */
const createVideoPillar = function(xrHelper: WebXRDefaultExperience, videoName: String,  pos: Vector3, scene: Scene, rotAmount: number, around: Vector3 = new Vector3(0,1,0)) {
    var pillar = MeshBuilder.CreateBox('pillar' + videoName, {
        width: 1.5,
        height: 7,
        depth: 2
    }, scene)
    var pillarMaterial = new StandardMaterial(videoName + 'pillar', scene)
    pillarMaterial.diffuseColor = new Color3(0.5,0.5,0.5);
    pillar.material = pillarMaterial;
    pillar.position = pos.clone();
    
    var screen = Mesh.CreatePlane(videoName + 'Screen', 1, scene)
    var hScreen = Mesh.CreatePlane(videoName + 'highlight', 1.1, scene)    
    
    screen.position = pos.clone();
    screen.position.y = 1.1
    screen.position.z -= 1.01
    hScreen.position = screen.position.clone()
    hScreen.position.z += .005
    var hMat = new StandardMaterial('', scene)
    hMat.diffuseColor = new Color3(1,1,.6)
    hMat.emissiveColor = new Color3(1,1,.6)
    hScreen.material = hMat 
    screens.push(hScreen)
    pillar.addChild(hScreen)
    pillar.addChild(screen)

    pillar.rotateAround(new Vector3(0, 1, 0), around, rotAmount)

    var vTexture = new VideoTexture(videoName + '', 'src/videos/' + videoName + '.mp4', scene);
    vTexture.video.autoplay=false;
    var vMat = new StandardMaterial('FMat', scene);
    vMat.emissiveColor = new Color3(1,1,1);
    vMat.diffuseTexture = vTexture;
    screen.material = vMat;

    
    // pillar.rotateAround(new Vector3(0, 1, 0), new Vector3(0, 1, 0), Math.PI/4)
    

    scene.onPointerObservable.add((pointerInfo) => {
        const pointerEvent:PointerEvent = pointerInfo.event as PointerEvent;
        const inputSource = xrHelper.pointerSelection.getXRControllerByPointerId(pointerEvent.pointerId);
        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERDOWN:
                console.log('Pressed')
                if (inputSource?.motionController?.handness == "left") {
                    // console.log(playerCam.position.subtract(screen.position).length())
                    if (vTexture.video.paused && playerCam.position.subtract(screen.getAbsolutePosition()).length() < 5) {
                        vTexture.video.play();
                    } else {
                        vTexture.video.pause();
                    }
                }
            break
        }
    })
}
/**
 * Create pillars to fill the scene
 * @param size The size of the pillar (width, height, depth)
 * @param pos the offsett from around
 * @param scene scene to render on
 * @param rotAmount how much to rotate around "around"
 * @param around The point to rotate aroud
 * @param color the color of the pillar
 * @returns Mesh of the pillar
 */
const createPillar = function(size: Vector3, pos: Vector3, scene: Scene, rotAmount: number, around: Vector3, color: Color3): Mesh {
    let pillar = MeshBuilder.CreateBox('pillar' + pos, {
        width: size.x,
        height: size.y,
        depth: size.z
    })
    pillar.position = pos;
    pillar.rotateAround(around, new Vector3(0,1,0), rotAmount)
    let pMat = new StandardMaterial('pMat' + pos, scene);
    pMat.diffuseColor = color
    pillar.material = pMat
    return pillar
}

/**
 * The main function of our scene
 * @param engine The engine to render with
 * @param canvas HTML renderer
 */
const createScene = async function(engine: Engine, canvas: HTMLCanvasElement) {
    // Create the scene space
    const scene = new Scene(engine);
    //So we can register actions
    scene.actionManager = new ActionManager(scene);
    
    // Information and controlls
    var infoUi = MeshBuilder.CreatePlane("controlsUi", {width: 1, height: 1}, scene);
    infoUi.position.y = 1.5;
    infoUi.position.z = 2;
    
    var infoText = new GUI.TextBlock();
    infoText.text = "Controls \nLeft Trigger button: start/pause video \nRight Trigger button: show/hide instructions \nAction/Squeeze button: calibrate paddles\nAction/Squeeze button again: Project Paddle";
    infoText.resizeToFit = true;
    infoText.color = "white";
    infoText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    infoText.fontSize = 40;
    
    var infoTexture = GUI.AdvancedDynamicTexture.CreateForMesh(infoUi, 1024, 1024);
    infoTexture.addControl(infoText);
    
    // infoUi.rotateAround(new Vector3(0, 1, 0), new Vector3(0, 1, 0), Math.PI/4);
    
    //run every frame. Our main logic for accelerating
    scene.actionManager.registerAction(
        new ExecuteCodeAction(
            ActionManager.OnEveryFrameTrigger,
            updateSpeeds
        )
    );
    //Camera in the 2D view
    var camera = new FreeCamera("Camera1", new Vector3(0, 1, 0), scene);
    camera.attachControl(canvas, true);
    
    var light = new HemisphericLight("light1", new Vector3(0, 1, 1), scene);
    
    // Skybox
    var skybox = Mesh.CreateBox("skyBox", 1000, scene);
    var skyboxMaterial = new StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new CubeTexture("src/textures/skybox3", scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skyboxMaterial.disableLighting = true;
    skybox.material = skyboxMaterial;
            
    // Ground, not really used
    var groundTexture = new Texture("src/textures/grass.dds", scene);
    var groundMaterial = new StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseTexture = groundTexture;
    let ground: Mesh = MeshBuilder.CreateGround("ground", {
            height: 512, 
            width: 512,
            subdivisions: 32
        },
        scene);
    // well below the water
    ground.position.y = -5;
    ground.material = groundMaterial;
    
    // Water
    var waterMesh = MeshBuilder.CreateGround("waterMesh", {
        width: 512, 
        height: 512,
        subdivisions: 32,
     }, scene);
    waterMesh.position.y = 0.45;
    var water = new WaterMaterial("water", scene, new Vector2(512, 512));
    water.backFaceCulling = true;
    water.bumpTexture = new Texture("src/textures/waterbump.png", scene);
    water.windForce = 0;
    
    water.waveHeight = 0;
    water.bumpHeight = 0;
    water.waterColor = new Color3(0.047, 0.23, 0.015);
    water.waterColor2 = new Color3(0, .3, .3);
    water.colorBlendFactor = 0.5;
    water.addToRenderList(skybox);
    water.addToRenderList(ground);
    waterMesh.material = water;
     for(var i =0; i < 12; i++) {
        createPillar(new Vector3(Math.random() + 1, Math.random()*20+2, Math.random()*2+2), new Vector3(0, 1, Math.random()*30+20), scene, -Math.PI/6 * i, new Vector3(0,1,0), new Color3(0.6, 1, 1))
     }
    const aManager: AssetsManager = new AssetsManager(scene);
    const libertyTask = aManager.addMeshTask('CreateLiberty', 'LibertyStatue', 'src/models', 'LibertStatue.obj')
    libertyTask.onSuccess = (task) => {
        console.log(task)
        const mesh = task.loadedMeshes[0]
        mesh.position = new Vector3(12, 3, 20)
    }
    const xrHelper: WebXRDefaultExperience = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [waterMesh]
    });
    
    playerCam = xrHelper.input.xrCamera;
    //Disabling Teleportation
    xrHelper.teleportation.detach();
    xrHelper.pointerSelection.displayLaserPointer = false;
    xrHelper.pointerSelection.displaySelectionMesh = false;
    const availableFeatures = WebXRFeaturesManager.GetAvailableFeatures();

    //Create the forward video near spawn
    createVideoPillar(xrHelper, 'forward', new Vector3(0, 1, 3), scene, Math.PI/4);
    // Create the sweep video directly in fron of user
    createVideoPillar(xrHelper, 'sweep', new Vector3(0, 1, 12), scene, 0);
    // Initialize the paddle
    createPaddle(scene);

    scene.onPointerObservable.add((pointerInfo) => {
        const pointerEvent:PointerEvent = pointerInfo.event as PointerEvent;
        const inputSource = xrHelper.pointerSelection.getXRControllerByPointerId(pointerEvent.pointerId);
        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERDOWN:
                
                if (inputSource?.motionController?.handness == "right") {
                    // show/hide instructions
                    // infoUi
                    stateManager.instructionsVisible = !stateManager.instructionsVisible
                    
                }
            break
        }
    })
    
    // We only want to move the camera right before the frame is rendered to
    // avoid potential issues
    xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        switch (state) {
            // If we are notin XR we dont need this logic
            case WebXRState.IN_XR:
                scene.registerBeforeRender(() => {
                    let fps = engine.getFps()
                    //rotate the users camera
                    let rotQuat = Quaternion.RotationAxis(Vector3.Up(), rotAcc/fps);
                    (scene.activeCamera as WebXRCamera).rotationQuaternion.multiplyInPlace(rotQuat);
                    if (stateManager.instructionsVisible) {
                        infoUi.visibility = 1;
                        let playerCamPosition: Vector3 = (playerCam as WebXRCamera).position.clone()
                        infoUi.position = playerCamPosition;
                        infoUi.position.addInPlace(forwardDir.scale(2));
                        infoUi.rotation.y = Math.atan2(infoUi.position.x, infoUi.position.z)
                    } else {
                        infoUi.visibility = 0;
                    }
                    // We have to do forward direction this way. For some reason the forward Dir
                    // Drifts if we rotate it as we rotate the camera above
                    let temp1: Vector3 = paddleCenter.clone()
                    let temp2: Vector3 = playerCam.position.clone()
                    temp1.y = 0;
                    temp2.y = 0;
                    forwardDir = temp1.subtract(temp2)
                    forwardDir.normalize();
                    //Add the velocity
                    playerCam.position.addInPlace(playerAcceleration.scale(1/fps));
                    screens.forEach(screen => {
                        if (playerCam.position.subtract(screen.getAbsolutePosition()).length() < 4.5) {
                            screen.visibility = 1
                        } else {
                            screen.visibility = 0
                        }
                    })
                });
                break;
        }
    })
    // Register the controllers once they are added
    xrHelper.input.onControllerAddedObservable.add((xrController)=> {
        xrController.onMotionControllerInitObservable.add((motionController)=>{
            // Store the controllers globally
            if (motionController.handness == 'left') {
                leftController = xrController;
            } else {
                rightController = xrController;
            }
            const triggerComponent = motionController.getMainComponent();
            
            // For the windows MR it wasnt finding the buttons, it was a squeeze instead
            if (motionController.getComponentOfType('button') != null) {
                const buttonComponent = motionController.getComponentOfType(WebXRControllerComponent.BUTTON_TYPE)
                buttonComponent?.onButtonStateChangedObservable.add((component) => {
                    // Call calibration
                    if(component.changes.pressed?.current) {
                        if (stateManager.controllersReady) {
                            stateManager.projectPaddle = !stateManager.projectPaddle;
                        } else {
                            stateManager.controllersReady = true
                        }
                    }
                });
            } else {
                const squeezeComponent = motionController.getComponentOfType('squeeze')
                squeezeComponent?.onButtonStateChangedObservable.add((component) => {
                    // Call calibration
                    if(component.changes.pressed?.current) {
                        if (stateManager.controllersReady) {
                            stateManager.projectPaddle = !stateManager.projectPaddle;
                        } else {
                            stateManager.controllersReady = true
                        }
                    }
                });
            }
        
        });
    })
    // Stop doing everything
    // xrHelper.input.onControllerRemovedObservable.add((xrController)=>{
    //     stateManager.controllersReady = false;
    //     paddle.position = new Vector3(0, -10, 0);
    //     lefthand.position = new Vector3(0, -10, 0);
    //     righthand.position = new Vector3(0, -10, 0);
    // })
    return scene;
}


const scene = createScene(engine, 
    engine.getRenderingCanvas() as HTMLCanvasElement).then(
        function (scene: Scene) {
            // Register a render loop to repeatedly render the scene
            engine.runRenderLoop(function () { 
                scene.render();
            });
    
            // Watch for browser/canvas resize events
            window.addEventListener("resize", function () { 
                engine.resize();
            });
    
        }
    )

