// Variables globales
var modelo = null;
var modelo2 = null;
var modelo3 = null;
var drawingcanvas;
var brushWidth = 15; // Aumenté el ancho para mejor visibilidad
var brushColor = "#000000";

// Inicialización de Fabric.js Canvas
function initDrawingCanvas() {
   var $ = function(id){return document.getElementById(id)};

  drawingcanvas = this.__canvas = new fabric.Canvas('bigcanvas', {
    isDrawingMode: true
  });

  fabric.Object.prototype.transparentCorners = false;

  if (drawingcanvas.freeDrawingBrush) {
    drawingcanvas.freeDrawingBrush.color = brushColor;
    drawingcanvas.freeDrawingBrush.width = brushWidth;
  }
}

// Configuración de elementos
var smallcanvas = document.getElementById("smallcanvas");
var ctx2 = smallcanvas.getContext("2d", { willReadFrequently: true });

function limpiar() {
    drawingcanvas.clear();
    drawingcanvas.backgroundColor = '#ffffff';
    ctx2.clearRect(0, 0, smallcanvas.width, smallcanvas.height);
    
    // Limpiar resultados
    document.getElementById("resultado").textContent = "-";
    document.getElementById("resultado2").textContent = "-";
    document.getElementById("resultado3").textContent = "-";
    
    // Limpiar barras de confianza
    resetConfidenceBars();
}

function resetConfidenceBars() {
    const bars = document.querySelectorAll('.progress-bar');
    bars.forEach(bar => {
        bar.style.width = '0%';
        bar.textContent = '0%';
        bar.className = 'progress-bar'; // Reset classes
    });
}

async function predecir() {
    if (!modelo || !modelo2 || !modelo3) {
        alert("Los modelos aún se están cargando. Por favor espere...");
        return;
    }

    try {
        // Convertir el canvas de Fabric.js a imagen
        const dataURL = drawingcanvas.toDataURL({
            format: 'png',
            quality: 1
        });
        
        // Crear una imagen temporal para redimensionar
        const img = new Image();
        img.src = dataURL;
        
        await new Promise((resolve) => {
            img.onload = () => {
                // Dibujar la imagen en el canvas pequeño y redimensionar
                ctx2.clearRect(0, 0, smallcanvas.width, smallcanvas.height);
                ctx2.drawImage(img, 0, 0, 28, 28);
                resolve();
            };
        });

        // Obtener y procesar los datos de la imagen
        const imgData = ctx2.getImageData(0, 0, 28, 28);
        const processedData = processImageData(imgData);
        
        // Convertir a tensor 4D
        const tensor4 = tf.tensor4d(processedData, [1, 28, 28, 1]);
        
        // Realizar predicciones
        const [resultados1, resultados2, resultados3] = await Promise.all([
            modelo.predict(tensor4).array(),
            modelo2.predict(tensor4).array(),
            modelo3.predict(tensor4).array()
        ]);
        
        // Mostrar resultados
        displayResults(
            resultados1[0][0], 
            resultados2[0][0], 
            resultados3[0][0]
        );
        
        // Liberar memoria del tensor
        tensor4.dispose();
    } catch (error) {
        console.error("Error durante la predicción:", error);
        alert("Ocurrió un error al realizar la predicción. Por favor intenta nuevamente.");
    }
}

function processImageData(imgData) {
    const arr = [];
    for (let p = 0; p < imgData.data.length; p += 4) {
        // Convertir a escala de grises e invertir (MNIST usa fondo blanco)
        const grayValue = 255 - (
            0.299 * imgData.data[p] + 
            0.587 * imgData.data[p + 1] + 
            0.114 * imgData.data[p + 2]
        );
        // Normalizar a [0, 1]
        arr.push(grayValue / 255);
    }
    return arr;
}

function displayResults(pred1, pred2, pred3) {
    // Obtener el dígito con mayor probabilidad para cada modelo
    const digit1 = pred1.indexOf(Math.max(...pred1));
    const digit2 = pred2.indexOf(Math.max(...pred2));
    const digit3 = pred3.indexOf(Math.max(...pred3));
    
    // Calcular porcentajes de confianza
    const confidence1 = (Math.max(...pred1) * 100).toFixed(1);
    const confidence2 = (Math.max(...pred2) * 100).toFixed(1);
    const confidence3 = (Math.max(...pred3) * 100).toFixed(1);
    
    // Actualizar la interfaz
    document.getElementById('resultado').textContent = digit1;
    document.getElementById('resultado2').textContent = digit2;
    document.getElementById('resultado3').textContent = digit3;
    
    updateConfidenceBar('confidence1', confidence1);
    updateConfidenceBar('confidence2', confidence2);
    updateConfidenceBar('confidence3', confidence3);
}

function updateConfidenceBar(elementId, confidence) {
    const element = document.getElementById(elementId);
    element.style.width = `${confidence}%`;
    element.textContent = `${confidence}%`;
    
    // Cambiar color según la confianza
    element.className = 'progress-bar'; // Reset classes
    const confidenceValue = parseFloat(confidence);
    if (confidenceValue > 80) {
        element.classList.add('bg-success');
    } else if (confidenceValue > 50) {
        element.classList.add('bg-warning');
    } else {
        element.classList.add('bg-danger');
    }
}

// Carga de modelos
(async () => {
    // Inicializar el canvas de dibujo primero
    initDrawingCanvas();
    
    try {
        console.log("Cargando modelo 1...");
        modelo = await tf.loadGraphModel("NNS/DENSA/model.json");
        console.log("Modelo 1 cargado");
        
        console.log("Cargando modelo 2...");
        modelo2 = await tf.loadGraphModel("NNS/CNN/model.json");
        console.log("Modelo 2 cargado");
        
        console.log("Cargando modelo 3...");
        modelo3 = await tf.loadGraphModel("NNS/CNN+DATA_AUMENTATION+DROUP/model.json");
        console.log("Modelo 3 cargado");
        
        console.log("Todos los modelos cargados. Listo para predecir.");
        
        // Habilitar botón de predecir
        document.getElementById('predecir').disabled = false;
    } catch (error) {
        console.error("Error al cargar modelos:", error);
        alert("Error al cargar los modelos. Por favor revisa la consola para más detalles.");
    }
})();

