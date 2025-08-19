// Variables globales
let modelo = null;
let modelo2 = null;
let modelo3 = null;
let isDrawing = false;
let lastX = 0;
let lastY = 0;

// Elementos del DOM
const canvas = document.getElementById("bigcanvas");
const ctx1 = canvas.getContext("2d");
const smallcanvas = document.getElementById("smallcanvas");
const ctx2 = smallcanvas.getContext("2d");
const btnPredecir = document.getElementById("predecir");
const btnLimpiar = document.getElementById("limpiar");

// Configuración inicial del canvas de dibujo
function setupCanvas() {
    ctx1.lineWidth = 15;
    ctx1.lineCap = 'round';
    ctx1.strokeStyle = '#000000';
    ctx1.fillStyle = '#FFFFFF';
    ctx1.fillRect(0, 0, canvas.width, canvas.height);
    
    // Eventos para dibujo con mouse
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);
    
    // Eventos para pantallas táctiles
    canvas.addEventListener('touchstart', handleTouchStart);
    canvas.addEventListener('touchmove', handleTouchMove);
    canvas.addEventListener('touchend', stopDrawing);
    
    // Eventos de botones
    btnPredecir.addEventListener('click', predecir);
    btnLimpiar.addEventListener('click', limpiar);
}

// Funciones para el dibujo
function startDrawing(e) {
    isDrawing = true;
    const pos = getPosition(e);
    [lastX, lastY] = [pos.x, pos.y];
}

function draw(e) {
    if (!isDrawing) return;
    
    const pos = getPosition(e);
    
    ctx1.beginPath();
    ctx1.moveTo(lastX, lastY);
    ctx1.lineTo(pos.x, pos.y);
    ctx1.stroke();
    
    [lastX, lastY] = [pos.x, pos.y];
}

function stopDrawing() {
    isDrawing = false;
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function handleTouchMove(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY
    });
    canvas.dispatchEvent(mouseEvent);
}

function getPosition(e) {
    const rect = canvas.getBoundingClientRect();
    return {
        x: (e.clientX || e.touches[0].clientX) - rect.left,
        y: (e.clientY || e.touches[0].clientY) - rect.top
    };
}

// Función para limpiar los canvas
function limpiar() {
    ctx1.fillStyle = '#FFFFFF';
    ctx1.fillRect(0, 0, canvas.width, canvas.height);
    ctx2.clearRect(0, 0, smallcanvas.width, smallcanvas.height);
    
    // Limpiar resultados
    document.getElementById("resultado").textContent = "-";
    document.getElementById("resultado2").textContent = "-";
    document.getElementById("resultado3").textContent = "-";
    
    // Limpiar barras de confianza
    document.querySelectorAll('.progress-bar').forEach(el => {
        el.style.width = '0%';
        el.textContent = '0%';
    });
}

// Función principal de predicción
async function predecir() {
    if (!modelo || !modelo2 || !modelo3) {
        console.error("Los modelos no están cargados todavía");
        return;
    }

    try {
        // Redimensionar imagen a 28x28 píxeles
        resample_single(canvas, 28, 28, smallcanvas);
        
        // Obtener los datos de la imagen
        const imgData = ctx2.getImageData(0, 0, 28, 28);
        
        // Procesar los datos de la imagen correctamente
        const imageArray = [];
        for (let i = 0; i < imgData.data.length; i += 4) {
            // Convertir a escala de grises e invertir (MNIST usa fondo blanco)
            const grayValue = 255 - (
                0.299 * imgData.data[i] + 
                0.587 * imgData.data[i + 1] + 
                0.114 * imgData.data[i + 2]
            );
            // Normalizar a [0, 1]
            imageArray.push(grayValue / 255);
        }
        
        // Crear el tensor con la forma correcta [batch, height, width, channels]
        const tensorData = tf.tensor4d(imageArray, [1, 28, 28, 1]);
        
        // Realizar predicciones
        const [resultados1, resultados2, resultados3] = await Promise.all([
            modelo.predict(tensorData).array(),
            modelo2.predict(tensorData).array(),
            modelo3.predict(tensorData).array()
        ]);
        
        // Mostrar resultados
        displayResults(resultados1[0], resultados2[0], resultados3[0]);
        
        // Liberar memoria del tensor
        tensorData.dispose();
    } catch (error) {
        console.error("Error durante la predicción:", error);
        alert("Ocurrió un error al realizar la predicción. Por favor intenta nuevamente.");
    }
}
// Procesamiento de los datos de la imagen
function preprocessImageData(imgData) {
    const arr = [];
    const arr28 = [];
    
    for (let p = 0; p < imgData.data.length; p += 4) {
        // Usar el canal alpha si existe, de lo contrario convertir RGB a escala de grises
        let val = imgData.data[p + 3] > 0 ? imgData.data[p + 3] : 
                 (imgData.data[p] * 0.3 + imgData.data[p + 1] * 0.59 + imgData.data[p + 2] * 0.11);
        
        // Normalizar e invertir (MNIST usa fondo blanco con dígitos negros)
        val = (255 - val) / 255.0;
        arr28.push(val);
        
        if (arr28.length === 28) {
            arr.push(arr28);
            arr28.length = 0;
        }
    }
    
    return [arr]; // Estructura para tensorflow: [batch, height, width, channels]
}

// Mostrar resultados en la interfaz
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
    const confidenceValue = parseFloat(confidence);
    if (confidenceValue > 80) {
        element.classList.remove('bg-warning', 'bg-danger');
        element.classList.add('bg-success');
    } else if (confidenceValue > 50) {
        element.classList.remove('bg-success', 'bg-danger');
        element.classList.add('bg-warning');
    } else {
        element.classList.remove('bg-success', 'bg-warning');
        element.classList.add('bg-danger');
    }
}

// Función para redimensionar la imagen (hermite resample)
function resample_single(canvas, width, height, resize_canvas) {
    var width_source = canvas.width;
    var height_source = canvas.height;
    width = Math.round(width);
    height = Math.round(height);

    var ratio_w = width_source / width;
    var ratio_h = height_source / height;
    var ratio_w_half = Math.ceil(ratio_w / 2);
    var ratio_h_half = Math.ceil(ratio_h / 2);

    var ctx = canvas.getContext("2d");
    var ctx2 = resize_canvas.getContext("2d");
    var img = ctx.getImageData(0, 0, width_source, height_source);
    var img2 = ctx2.createImageData(width, height);
    var data = img.data;
    var data2 = img2.data;

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

    ctx2.putImageData(img2, 0, 0);
}

// Carga de modelos
async function cargarModelos() {
    try {
        btnPredecir.disabled = true;
        btnPredecir.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Cargando modelos...';
        
        console.log("Cargando modelo 1...");
        modelo = await tf.loadGraphModel("NNS/DENSA/model.json");
        console.log("Modelo 1 cargado");
        
        console.log("Cargando modelo 2...");
        modelo2 = await tf.loadGraphModel("NNS/CNN/model.json");
        console.log("Modelo 2 cargado");
        
        console.log("Cargando modelo 3...");
        modelo3 = await tf.loadGraphModel("NNS/CNN+DATA_AUMENTATION+DROUP/model.json");
        console.log("Modelo 3 cargado");
        
        btnPredecir.disabled = false;
        btnPredecir.textContent = "Predecir";
        console.log("Todos los modelos cargados. Listo para predecir.");
    } catch (error) {
        console.error("Error al cargar modelos:", error);
        btnPredecir.disabled = true;
        btnPredecir.textContent = "Error cargando modelos";
        alert("Error al cargar los modelos. Por favor revisa la consola para más detalles.");
    }
}

// Inicialización cuando la página carga
document.addEventListener('DOMContentLoaded', () => {
    setupCanvas();
    cargarModelos();
});

