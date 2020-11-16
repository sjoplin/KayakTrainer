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

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; // Get the canvas element 
const engine = new Engine(canvas, true); // Generate the BABYLON 3D engine

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
    projectPaddle: false
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

/***
 * This creates the paddle in the environment. It is initially hidden below the map
 */
const createPaddle = function(waterMesh: Mesh, scene: Scene) {
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
    // paddle.addChild(lefthand)
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
const createVideoPillar = function(videoName: String,  pos: Vector3, scene: Scene, rotAmount: number, around: Vector3 = new Vector3(0,1,0)) {
    var pillar = MeshBuilder.CreateBox('pillar' + videoName, {
        width: 1.5,
        height: 7,
        depth: 2
    }, scene)
    var pillarMaterial = new StandardMaterial(videoName + 'pillar', scene)
    pillarMaterial.diffuseColor = new Color3(0,0,0);
    pillar.material = pillarMaterial;
    pillar.position = pos.clone();
    
    var screen = Mesh.CreatePlane(videoName + 'Screen', 1, scene)
    screen.position = pos.clone();
    screen.position.y = 1.1
    screen.position.z -= 1.001
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
        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERDOWN:
                // console.log(playerCam.position.subtract(screen.position).length())
                if (vTexture.video.paused && playerCam.position.subtract(screen.getAbsolutePosition()).length() < 5) {
                    vTexture.video.play();
                } else {
                    vTexture.video.pause();
                }
            break
        }
    })
}

/******* Add the Playground Class with a static CreateScene function ******/

const createScene = async function(engine: Engine, canvas: HTMLCanvasElement) {
    // Create the scene space
    const scene = new Scene(engine);
    scene.actionManager = new ActionManager(scene);
    
    // Information and controlls
    var infoUi = MeshBuilder.CreatePlane("controlsUi", {width: 1, height: 1}, scene);
    infoUi.position.y = 1.5;
    infoUi.position.z = 2;
    
    var infoText = new GUI.TextBlock();
    infoText.text = "Controls \nTrigger button: start/pause video \nAction/Squeeze button: calibrate paddles";
    infoText.resizeToFit = true;
    infoText.color = "white";
    infoText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    infoText.fontSize = 40;
    
    var infoTexture = GUI.AdvancedDynamicTexture.CreateForMesh(infoUi, 1024, 1024);
    infoTexture.addControl(infoText);
    
    infoUi.rotateAround(new Vector3(0, 1, 0), new Vector3(0, 1, 0), Math.PI/4)
    
    scene.actionManager.registerAction(
        new ExecuteCodeAction(
            ActionManager.OnEveryFrameTrigger,
            function() {
                if (stateManager.controllersReady) {
                    calibrateControllers();
                    if (playerCam != undefined) {
                        let hips: Vector3 = (scene.activeCamera as WebXRCamera).position.clone()
                        if (stateManager.projectPaddle) {
                            hips.addInPlace(forwardDir.scale(projectedScale))
                        }
                        hips.y = 0
                        if (leftBlade.getAbsolutePosition().y < .6) {
                            delay++;
                            let contactPoint: Vector3 = leftBlade.getAbsolutePosition().clone();
                            contactPoint.y = 0;
                            let contactVec: Vector3 = hips.subtract(contactPoint);
                    
                            if (delay > 10) {
                                
                                // console.log('haptics on left controller');
                                let leftVel = contactPoint.subtract(prevLeft);
                                console.log(leftVel);
                                leftController.motionController?.pulse(leftVel.length()*40,.1);
                                // let horizontal = Vector3.Dot(leftVel, Vector3.Cross(Vector3.Up(), forwardDir))
                                let ratio = Math.min(contactVec.length()/.95, 1);
                                let dot = Vector3.Dot(leftVel.scale(ratio), forwardDir)
                                rotAcc -= dot;
                                
                                leftVel.scaleInPlace(1-ratio);
                                let change = forwardDir.scale(Vector3.Dot(leftVel, forwardDir));
                                playerAcceleration.addInPlace(change.negate());
                            }
                            
                        } else if (rightBlade.getAbsolutePosition().y < .6) {
                            delay++;
                            let contactPoint: Vector3 = rightBlade.getAbsolutePosition().clone();
                            contactPoint.y = 0;
                            let contactVec: Vector3 = hips.subtract(contactPoint);
                            if (delay > 10) {
                                // // rightController.motionController?.pulse(.1,1);
                                // console.log('haptics on right controller');
                                let rightVel = contactPoint.subtract(prevRight);
                                rightController.motionController?.pulse(rightVel.length()*40,.1);
                                let ratio = Math.min(contactVec.length()/.95, 1);
                                let dot = Vector3.Dot(rightVel.scale(ratio), forwardDir);
                                
                                rotAcc += dot;
                                rightVel.scaleInPlace(1-ratio);
                                let change = forwardDir.scale(Vector3.Dot(rightVel, forwardDir));
                                playerAcceleration.addInPlace(change.negate());
                            }
                        } else {
                            delay = 0;
                            
                        }
                        
                    }
                    
                    // console.log(forwardDir);
                    rotAcc*=.98
                    // console.log('Rotation Acceleration:' + rotAcc)
                    //Capping the movement speed
                    if (rotAcc > 0) {
                        rotAcc = Math.min(rotAcc, 1)
                    } else {
                        rotAcc = Math.max(rotAcc, -1)
                    }
                    if (playerAcceleration.length() > 2) {
                        playerAcceleration.scaleInPlace(2/playerAcceleration.length());
                    } else {
                        playerAcceleration.scaleInPlace(.995);
                    }
                    prevLeft = leftBlade.getAbsolutePosition().clone();
                    prevLeft.y = 0;
                    prevRight = rightBlade.getAbsolutePosition().clone();
                    prevRight.y = 0;
                }
            }
        )
    );

    
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
            
    // Ground
    var groundTexture = new Texture("src/textures/grass.dds", scene);
    // groundTexture.vScale = groundTexture.uScale = 8.0;
    
    var groundMaterial = new StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseTexture = groundTexture;
    
    let ground: Mesh = MeshBuilder.CreateGround("ground", {
            height: 512, 
            width: 512,
            subdivisions: 32
        },
        scene);
    
    ground.position.y = -5;
    
    ground.material = groundMaterial;
    // XR stuff
    
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
    const xrHelper: WebXRDefaultExperience = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [waterMesh]
    });
    playerCam = xrHelper.input.xrCamera;
    //Disabling Teleportation
    xrHelper.teleportation.detach();
    xrHelper.pointerSelection.detach();
    const availableFeatures = WebXRFeaturesManager.GetAvailableFeatures();

    createVideoPillar('forward', new Vector3(0, 1, 3), scene, Math.PI/4);
    createVideoPillar('sweep', new Vector3(0, 1, 12), scene, 0)
    createPaddle(waterMesh, scene);
    
    
    xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        switch (state) {
            case WebXRState.IN_XR:
                scene.registerBeforeRender(() => {
                    let fps = engine.getFps()
                    let rotQuat = Quaternion.RotationAxis(Vector3.Up(), rotAcc/fps);
                    (scene.activeCamera as WebXRCamera).rotationQuaternion.multiplyInPlace(rotQuat);
                    
                    // forwardDir = forwardDir.rotateByQuaternionAroundPointToRef(rotQuat,playerCam.position, forwardDir);
                    let temp1: Vector3 = paddleCenter.clone()
                    let temp2: Vector3 = playerCam.position.clone()
                    temp1.y = 0;
                    temp2.y = 0;
                    forwardDir = temp1.subtract(temp2)
                    forwardDir.normalize();
                    // console.log(forwardDir);
                    playerCam.position.addInPlace(playerAcceleration.scale(1/fps));
                });
                break;
        }
    })

    xrHelper.input.onControllerAddedObservable.add((xrController)=> {
        xrController.onMotionControllerInitObservable.add((motionController)=>{
            // console.log(motionController)
            if (motionController.handness == 'left') {
                leftController = xrController;
            } else {
                rightController = xrController;
            }
            
            const triggerComponent = motionController.getMainComponent();
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
                        stateManager.controllersReady = true
                    }
                });
            }
            // triggerComponent.onButtonStateChangedObservable.add((component) => {
            //     console.log(component);
            // })
            
        });
    })
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


const calibrateControllers = function() {
    
    let left: Vector3 = leftController.grip!.getAbsolutePosition().clone();//.scale(1/numIters);
    let right: Vector3 = rightController.grip!.getAbsolutePosition().clone();//.scale(1/numIters);
    paddleCenter = Vector3.Center(left, right);
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

