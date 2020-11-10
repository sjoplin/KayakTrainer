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
import { WebXRControllerComponent, WebXRInputSource } from "@babylonjs/core/XR";
import { ActionManager } from "@babylonjs/core/Actions/actionManager";
import { SwitchBooleanAction, ExecuteCodeAction } from "@babylonjs/core/Actions";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement; // Get the canvas element 
const engine = new Engine(canvas, true); // Generate the BABYLON 3D engine
let controllerOffset: Vector3;
let paddleCenter: Vector3 = new Vector3(0, 3, 3);

let leftController: WebXRInputSource;
let rightController: WebXRInputSource;
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
                console.log(stateManager.leftIn)
            }
        )
    );

    
    var camera = new FreeCamera("Camera1", new Vector3(0, 100, 0), scene);
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
    groundTexture.vScale = groundTexture.uScale = 8.0;
    
    var groundMaterial = new StandardMaterial("groundMaterial", scene);
    groundMaterial.diffuseTexture = groundTexture;
    
    var ground = Mesh.CreateGround("ground", 512, 512, 32, scene, false);
    
    ground.position.y = -1.5;
    ground.material = groundMaterial;
    // XR stuff
    
    // Water
    var waterMesh = Mesh.CreateGround("waterMesh", 512, 512, 32, scene, false);
    waterMesh.position.y = -.1;
    var water = new WaterMaterial("water", scene, new Vector2(512, 512));
    water.backFaceCulling = true;
    water.bumpTexture = new Texture("src/textures/waterbump.png", scene);
    water.windForce = -5;
    water.waveHeight = 0.2;
    water.bumpHeight = 0.05;
    water.waterColor = new Color3(0.047, 0.23, 0.015);
    water.colorBlendFactor = 0.5;
    water.addToRenderList(skybox);
    water.addToRenderList(ground);
    waterMesh.material = water;
    const xrHelper: WebXRDefaultExperience = await scene.createDefaultXRExperienceAsync({
        floorMeshes: [waterMesh]
    });
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

    let leftBlade = MeshBuilder.CreateBox('leftBlade', {
        width: .3,
        height: .55,
        depth: .01
    })
    leftBlade.position = paddle.position.add(new Vector3(0, .69, 0));
    paddle.addChild(leftBlade);
    leftBlade.actionManager = new ActionManager(scene);
    leftBlade.actionManager.registerAction(
        new ExecuteCodeAction(
            {
                trigger: ActionManager.OnIntersectionEnterTrigger, 
                parameter: { 
                    mesh: waterMesh
                }
            }, 
            function() {
                console.log('Hallo')
            }
            // stateManager,
            // 'leftIn'
        )
    );
    let rightBlade = MeshBuilder.CreateBox('rightBlade', {
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
        console.log(xrController);
        xrController.onMotionControllerInitObservable.add((motionController)=>{
            console.log(motionController)
            if (motionController.handness == 'left') {
                leftController = xrController;
            } else {
                rightController = xrController;
            }
            
            const triggerComponent = motionController.getMainComponent();
            const buttonComponent = motionController.getComponentOfType('squeeze');
                
            buttonComponent?.onButtonStateChangedObservable.add((component) => {
                // Call calibration
                if(component.changes.pressed?.current) {
                    stateManager.controllersReady = true
                }
            });
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