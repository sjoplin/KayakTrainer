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
import { SwitchBooleanAction, ExecuteCodeAction } from "@babylonjs/core/Actions";
import * as GUI from 'babylonjs-gui';

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; // Get the canvas element 
const engine = new Engine(canvas, true); // Generate the BABYLON 3D engine
let first = true;

// Paddle Related things
let paddleCenter: Vector3 = new Vector3(0, 3, 3);
let leftController: WebXRInputSource;
let rightController: WebXRInputSource;
let rotationOffset: Vector3;
// Globals for Tracking Paddle Movement
let delay: number = 0;
let leftIdx = 0;
let prevLeft: Vector3 = new Vector3(0,0,0);//[] = new Array(10);
let rightIdx= 0;
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
    leftIn: false,
    rightIn: false
}

let paddle: Mesh;

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
                }
            
                if (playerCam != undefined) {
                    let hips: Vector3 = playerCam.position.clone()
                    hips.y = 0
                    if (stateManager.leftIn) {
                        delay++;
                        let contactPoint: Vector3 = leftBlade.getAbsolutePosition().clone();
                        contactPoint.y = 0;
                        let contactVec: Vector3 = hips.subtract(contactPoint);
                
                        if (delay > 10) {
                            leftController.motionController?.pulse(1,1);
                            console.log('haptics on left controller');
                            let leftVel = contactPoint.subtract(prevLeft);
                            let ratio = Math.min(contactVec.length()/.8, 1);
                            let rotTorq = leftVel.multiply(new Vector3(ratio, ratio, ratio));
                            leftVel.scaleInPlace(1-ratio);
                            let dot = Vector3.Dot(leftVel, forwardDir)
                            if (dot < 0) {
                                rotAcc += rotTorq.length();
                            } else {
                                rotAcc -= rotTorq.length();
                            }
                            let change = forwardDir.scale(dot);
                            playerAcceleration.addInPlace(change.negate());
                        }
                        
                    } else if (stateManager.rightIn) {
                        delay++;
                        let contactPoint: Vector3 = rightBlade.getAbsolutePosition().clone();
                        contactPoint.y = 0;
                        let contactVec: Vector3 = hips.subtract(contactPoint);
                        if (delay > 10) {
                            rightController.motionController?.pulse(1,1);
                            console.log('haptics on right controller');
                            let rightVel = contactPoint.subtract(prevRight);
                            let ratio = Math.min(contactVec.length()/.8, 1);
                            let rotTorq = rightVel.multiply(new Vector3(ratio, ratio, ratio));
                            rightVel.scaleInPlace(1-ratio);
                            let dot = Vector3.Dot(rightVel, forwardDir);
                            if (dot < 0) {
                                rotAcc -= rotTorq.length();
                            } else {
                                rotAcc += rotTorq.length();
                            }
                            let change = forwardDir.scale(dot);
                            playerAcceleration.addInPlace(change.negate());
                        }
                    } else {
                        delay = 0;
                    }
                    
                }
                
                
                rotAcc*=.93
                playerAcceleration.scale(.7);
                prevLeft = leftBlade.getAbsolutePosition().clone();
                prevLeft.y = 0;
                prevRight = rightBlade.getAbsolutePosition().clone();
                prevRight.y = 0;
                leftIdx = (leftIdx+1)%10;
                rightIdx = (rightIdx+1)%10;
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
    waterMesh.position.y = 0.5;
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
    const availableFeatures = WebXRFeaturesManager.GetAvailableFeatures();

    // Video
    var forwardScreen = Mesh.CreatePlane('Forward', 1, scene)
    forwardScreen.position.y = 1;
    forwardScreen.position.z = 3;
    forwardScreen.rotateAround(new Vector3(0, 1, 0), new Vector3(0, 1, 0), Math.PI/4)
    var forwardTexture = new VideoTexture("VideoForward", 'src/videos/forward.mp4', scene);
    forwardTexture.video.preload='auto';
    
    var forwardMat = new StandardMaterial('FMat', scene);
    forwardMat.emissiveColor = new Color3(1,1,1);
    forwardMat.diffuseTexture = forwardTexture;
    forwardScreen.material = forwardMat;

    paddle = Mesh.CreateCylinder('paddle', 1.97, .1, .1, 24, 1, scene, true)
    
    paddle.position = paddleCenter;

    leftBlade = MeshBuilder.CreateBox('leftBlade', {
        width: .3,
        height: .55,
        depth: .01
    })
    leftBlade.position = paddle.position.add(new Vector3(0, .69, 0));
    paddle.addChild(leftBlade);
    leftBlade.actionManager = new ActionManager(scene);
    leftBlade.actionManager.registerAction(
        new SwitchBooleanAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger, 
                parameter: { 
                    mesh: waterMesh
                }
            }, 
            
            stateManager,
            'leftIn'
        )
    );
    leftBlade.actionManager.registerAction(
        new SwitchBooleanAction(
            {
                trigger: ActionManager.OnIntersectionExitTrigger, 
                parameter: { 
                    mesh: waterMesh
                }
            }, 
            
            stateManager,
            'leftIn'
        )
    );
    
    rightBlade = MeshBuilder.CreateBox('rightBlade', {
        width: .3,
        height: .55,
        depth: .01
    })
    rightBlade.position = paddle.position.add(new Vector3(0, -.69, 0));
    paddle.addChild(rightBlade)
    rightBlade.actionManager = new ActionManager(scene);
    rightBlade.actionManager?.registerAction(
        new SwitchBooleanAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger, 
                parameter: { 
                    mesh: waterMesh, 
                    usePreciseIntersection: true
                }
            }, 
            stateManager,
            'rightIn'
        )
    );
    rightBlade.actionManager?.registerAction(
        new SwitchBooleanAction(
            {
                trigger: ActionManager.OnIntersectionExitTrigger, 
                parameter: { 
                    mesh: waterMesh, 
                    usePreciseIntersection: true
                }
            }, 
            stateManager,
            'rightIn'
        )
    );
    scene.onPointerObservable.add((pointerInfo) => {
        switch (pointerInfo.type) {
            case PointerEventTypes.POINTERDOWN:
                if (forwardTexture.video.paused) {
                    forwardTexture.video.play();
                } else {
                    forwardTexture.video.pause();
                }
            break
        }
    })
    xrHelper.baseExperience.onStateChangedObservable.add((state) => {
        switch (state) {
            case WebXRState.IN_XR:
                scene.registerBeforeRender(() => {
                    let fps = engine.getFps()
                    let rotQuat = Quaternion.RotationAxis(Vector3.Up(), rotAcc/fps);
                    (scene.activeCamera as WebXRCamera).rotationQuaternion.multiplyInPlace(rotQuat);
                    forwardDir = forwardDir.rotateByQuaternionAroundPointToRef(rotQuat,playerCam.position, forwardDir);
                    forwardDir.normalize();
                    
                    playerCam.position.addInPlace(playerAcceleration.scale(1/fps));
                });
                break;
        }
    })

    xrHelper.input.onControllerAddedObservable.add((xrController)=> {
        xrController.onMotionControllerInitObservable.add((motionController)=>{
            console.log(motionController)
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
                        stateManager.controllersReady = true
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
    // // paddle.rotation.z = temp.z
    
    // paddle.rotation = new Vector3(0,Math.atan(dz/dx),Math.atan(dy/dx) + Math.PI/2)
    if (rotationOffset === undefined) {
        rotationOffset = paddle.rotation.subtract(rightController.grip!.absoluteRotationQuaternion.toEulerAngles());
    }
    // paddle.rotation.x = rightController.grip!.absoluteRotationQuaternion.toEulerAngles().add(rotationOffset).y
    
    

}