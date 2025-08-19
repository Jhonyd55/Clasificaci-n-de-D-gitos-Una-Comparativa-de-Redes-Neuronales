var modelo = null;
var modelo2 = null;
var modelo3 = null;
var modelo4 = null;
var brushWidth = 15;
var color = "#000000";
var drawingcanvas; // Esta variable contendrá la instancia de Fabric.js

// Tomar y configurar el canvas pequeño. ctx2 debe ser el contexto del smallcanvas.
var smallcanvas = document.getElementById("smallcanvas");
var ctx2 = smallcanvas.getContext("2d", { willReadFrequently: true }); // CORREGIDO: ctx2 ahora es correctamente del smallcanvas

(function() {
    var $ = function(id) { return document.getElementById(id); };

    // Inicializa Fabric.js en el canvas grande.
    // Fabric.js gestionará el contexto 2D internamente. NO SE NECESITA ctx1 GLOBAL.
    drawingcanvas = this.__canvas = new fabric.Canvas('bigcanvas', {
        isDrawingMode: true // Permite dibujar a mano alzada
    });

    fabric.Object.prototype.transparentCorners = false;

    if (drawingcanvas.freeDrawingBrush) {
        drawingcanvas.freeDrawingBrush.color = color;
        drawingcanvas.freeDrawingBrush.width = brushWidth;
    }

    // Opcional: Desactivar la llamada a predecir en mouse:up si no la quieres aquí
    // drawingcanvas.on('mouse:up', function(o) {
    //     // Si quieres una predicción instantánea al soltar, descomenta esto.
    //     // Si solo quieres predecir con el botón, déjalo comentado.
    //     // var prediction = predecir();
    //     // document.getElementById('resultado_de_prediccion').innerHTML = prediction;
    // });

})();

function limpiar() {
    // Usa el método de Fabric.js para limpiar el canvas principal y sus objetos
    drawingcanvas.clear();
    drawingcanvas.renderAll(); // Asegura que el canvas se redibuje vacío

    // Limpiar resultados
    document.getElementById("resultado").textContent = "-";
    document.getElementById("resultado2").textContent = "-";
    document.getElementById("resultado3").textContent = "-";

    // Limpiar barras de confianza
    resetConfidenceBars();
}

function predecir() {
    // Obtiene el elemento HTML canvas subyacente de Fabric.js para pasarlo a resample_single
    var bigcanvasElement = drawingcanvas.getElement();

    // Pasa el elemento HTML canvas (gestionado por Fabric.js) a resample_single
    resample_single(bigcanvasElement, 28, 28, smallcanvas);

    // ctx2 ya está correctamente inicializado para smallcanvas al inicio del script.
    var imgData = ctx2.getImageData(0, 0, 28, 28);
    var arr = []; // El arreglo completo
    var arr28 = []; // Al llegar a 28 posiciones se pone en 'arr' como un nuevo indice
    for (var p = 0, i = 0; p < imgData.data.length; p += 4) {
        var valor = imgData.data[p + 3] / 255;
        arr28.push([valor]); // Agregar al arr28 y normalizar a 0-1.
        if (arr28.length == 28) {
            arr.push(arr28);
            arr28 = [];
        }
    }

    arr = [arr]; // Meter el arreglo en otro arreglo por que si no tio tensorflow se enoja >:(
    var tensor4 = tf.tensor4d(arr);

    // Modelo 1
    var resultados1 = modelo.predict(tensor4).dataSync();
    var mayorIndice = resultados1.indexOf(Math.max.apply(null, resultados1));
    console.log("Prediccion 1", mayorIndice);
    document.getElementById("resultado").innerHTML = mayorIndice;

    // Modelo 2
    var resultados2 = modelo2.predict(tensor4).dataSync();
    var mayorIndice = resultados2.indexOf(Math.max.apply(null, resultados2));
    console.log("Prediccion 2", mayorIndice);
    document.getElementById("resultado2").innerHTML = mayorIndice;

    // Modelo 3
    var resultados3 = modelo3.predict(tensor4).dataSync();
    var mayorIndice = resultados3.indexOf(Math.max.apply(null, resultados3));
    console.log("Prediccion 3", mayorIndice);
    document.getElementById("resultado3").innerHTML = mayorIndice;

    // Mostrar resultados
    displayResults(
        resultados1,
        resultados2,
        resultados3
    );
}

/**
 * Hermite resize - fast image resize/resample using Hermite filter. 1 cpu version!
 *
 * @param {HtmlElement} canvasSource El elemento canvas de origen (ej. el elemento HTML del Fabric.js canvas)
 * @param {int} width El ancho deseado para la imagen de salida
 * @param {int} height La altura deseada para la imagen de salida
 * @param {HtmlElement} canvasTarget El canvas donde se dibujará la imagen redimensionada (smallcanvas)
 */
function resample_single(canvasSource, width, height, canvasTarget) {
    var width_source = canvasSource.width;
    var height_source = canvasSource.height;
    width = Math.round(width);
    height = Math.round(height);

    // Obtiene el contexto 2D del canvas de origen que le pasamos (ej. bigcanvasElement)
    // Agregamos { willReadFrequently: true } para optimización como sugiere la advertencia
    var ctxSource = canvasSource.getContext("2d", { willReadFrequently: true });
    // Obtiene el contexto del canvas de destino (smallcanvas)
    var ctxTarget = canvasTarget.getContext("2d", { willReadFrequently: true }); // Nuevo contexto local para evitar el global ctx2

    var img = ctxSource.getImageData(0, 0, width_source, height_source);
    var img2 = ctxTarget.createImageData(width, height); // Usa ctxTarget para crear la imagen
    var data = img.data;
    var data2 = img2.data;

    var ratio_w = width_source / width;
    var ratio_h = height_source / height;
    var ratio_w_half = Math.ceil(ratio_w / 2);
    var ratio_h_half = Math.ceil(ratio_h / 2);

    for (var j = 0; j < height; j++) {
        for (var i = 0; i < width; i++) {
            var x2 = (i + j * width) * 4;
            var weight = 0;
            var weights = 0;
            var weights_alpha = 0;
            var gx_r = 0;
            var gx_g = 0;
            var gx_b = 0;
            var gx_a = 0;
            var center_y = (j + 0.5) * ratio_h;
            var yy_start = Math.floor(j * ratio_h);
            var yy_stop = Math.ceil((j + 1) * ratio_h);
            for (var yy = yy_start; yy < yy_stop; yy++) {
                var dy = Math.abs(center_y - (yy + 0.5)) / ratio_h_half;
                var center_x = (i + 0.5) * ratio_w;
                var w0 = dy * dy; //pre-calc part of w
                var xx_start = Math.floor(i * ratio_w);
                var xx_stop = Math.ceil((i + 1) * ratio_w);
                for (var xx = xx_start; xx < xx_stop; xx++) {
                    var dx = Math.abs(center_x - (xx + 0.5)) / ratio_w_half;
                    var w = Math.sqrt(w0 + dx * dx);
                    if (w >= 1) {
                        //pixel too far
                        continue;
                    }
                    //hermite filter
                    weight = 2 * w * w * w - 3 * w * w + 1;
                    var pos_x = 4 * (xx + yy * width_source);
                    //alpha
                    gx_a += weight * data[pos_x + 3];
                    weights_alpha += weight;
                    //colors
                    if (data[pos_x + 3] < 255)
                        weight = weight * data[pos_x + 3] / 250;
                    gx_r += weight * data[pos_x];
                    gx_g += weight * data[pos_x + 1];
                    gx_b += weight * data[pos_x + 2];
                    weights += weight;
                }
            }
            data2[x2] = gx_r / weights;
            data2[x2 + 1] = gx_g / weights;
            data2[x2 + 2] = gx_b / weights;
            data2[x2 + 3] = gx_a / weights_alpha;
        }
    }
    // Aplica la imagen redimensionada al canvas de destino (smallcanvas)
    ctxTarget.putImageData(img2, 0, 0); // Usa ctxTarget para dibujar
}

//Cargar modelos
(async () => {
    console.log("Cargando modelo 1...");
    modelo = await tf.loadGraphModel("NNS/DENSA/model.json");
    console.log("Modelo 1 cargado...");

    console.log("Cargando modelo 2...");
    modelo2 = await tf.loadGraphModel("NNS/CNN/model.json");
    console.log("Modelo 2 cargado...");

    console.log("Cargando modelo 3...");
    modelo3 = await tf.loadGraphModel("NNS/COMPLETA/model.json"); // Asumo que este es el modelo correcto
    console.log("Modelo 3 cargado...");

    // Si tienes un modelo 4, actívalo aquí
    // console.log("Cargando modelo 4...");
    // modelo4 = await tf.loadGraphModel("NNS/OtroModelo/model.json");
    // console.log("Modelo 4 cargado...");
})();

function resetConfidenceBars() {
    const bars = document.querySelectorAll('.progress-bar');
    bars.forEach(bar => {
        bar.style.width = '0%';
        bar.textContent = '0%';
        bar.className = 'progress-bar'; // Reset classes
    });
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
