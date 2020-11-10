import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3, Color3, Vector2 } from "@babylonjs/core/Maths/math";
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
import { WebXRCamera, WebXRControllerComponent, WebXRInputSource } from "@babylonjs/core/XR";
import { ActionManager } from "@babylonjs/core/Actions/actionManager";
import { SwitchBooleanAction, ExecuteCodeAction } from "@babylonjs/core/Actions";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; // Get the canvas element 
const engine = new Engine(canvas, true); // Generate the BABYLON 3D engine
let controllerOffset: Vector3;
let paddleCenter: Vector3 = new Vector3(0, 3, 3);

let leftController: WebXRInputSource;
let rightController: WebXRInputSource;
// Globals for Tracking Paddle Movement
let prevLeft: Vector3 = new Vector3();
let prevRight: Vector3 = new Vector3();
let leftBlade: Mesh;
let rightBlade: Mesh;

let playerCam: WebXRCamera;

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
    
    scene.actionManager.registerAction(
        new ExecuteCodeAction(
            ActionManager.OnEveryFrameTrigger,
            function() {
                if (stateManager.controllersReady) {
                    calibrateControllers();
                }
            
                if (playerCam != undefined) {
                    if (stateManager.leftIn) {
                        let leftVel = leftBlade.position.subtract(prevLeft);
                        leftVel.y = 0;
                        leftVel.x = 0;
                        leftVel.z /= 100;
                        playerCam.position.addInPlace(leftVel.negate());
                        
                    } else if (stateManager.rightIn) {
                        let rightVel = rightBlade.position.subtract(prevRight);
                        rightVel.y = 0;
                        rightVel.x = 0;
                        rightVel.z /= 100;
                        playerCam.position.addInPlace(rightVel.negate());
                    }
                }
                prevLeft = leftBlade.getAbsolutePosition();
                prevRight = rightBlade.getAbsolutePosition();
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
    waterMesh.position.y = 0.55;
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
    prevLeft = leftBlade.position;
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
    prevRight = rightBlade.position;
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
    let left: Vector3 = leftController.grip!.position.clone();//.scale(1/numIters);
    let right: Vector3 = rightController.grip!.position.clone();//.scale(1/numIters);
    controllerOffset = left.subtract(right);
    paddleCenter = Vector3.Center(left, right);
    paddle.position = paddleCenter;
    var dx = paddleCenter.x - left.x;
    var dy = paddleCenter.y - left.y;
    var dz = left.z - paddleCenter.z;
    paddle.rotation.z = Math.atan(dy/dx) + Math.PI/2;
    paddle.rotation.y = Math.atan(dz/dx);
    paddle.rotation.x = right.x;
}