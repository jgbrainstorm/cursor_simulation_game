const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const angleInput = document.getElementById('angle');
const powerInput = document.getElementById('power');
const fireButton = document.getElementById('fire');
const angleValue = document.getElementById('angleValue');
const powerValue = document.getElementById('powerValue');
const trialTableBody = document.getElementById('trialTableBody');
const clearHistoryButton = document.getElementById('clearHistory');

const PIXELS_PER_METER = 5; // 5 pixels = 1 meter
const CANVAS_WIDTH_METERS = canvas.width / PIXELS_PER_METER;

let cannonX = 10; // meters
let groundLevel = canvas.height - 40; // pixels
let cannonY = groundLevel / PIXELS_PER_METER; // meters
let ballX = cannonX;
let ballY = cannonY;
let velocityX = 0;
let velocityY = 0;
let gravity = 9.81; // m/s^2
let isFiring = false;
let trajectory = [];
let trialCount = 0;

// Add new variables for clouds and house
let clouds = [
    {x: 100, y: 50, size: 40},
    {x: 300, y: 30, size: 50},
    {x: 500, y: 70, size: 30},
    {x: 700, y: 40, size: 45}
];

// Add these new variables at the top of your file
let houseX = 650;
let houseY;
let houseWidth = 100;
let houseHeight = 100;
let houseIntact = true;
let explosionParticles = [];

// Add these new variables at the top of your file
const observationsTextarea = document.getElementById('observations');
const studentNameInput = document.getElementById('studentName');
const submitObservationsButton = document.getElementById('submitObservations');

// Add these new variables at the top of your file
let db;
const dbName = "StudentResponsesDB";

// Initialize the database
function initDB() {
    const request = indexedDB.open(dbName, 1);

    request.onerror = function(event) {
        console.error("Database error: " + event.target.error);
    };

    request.onsuccess = function(event) {
        db = event.target.result;
        console.log("Database opened successfully");
    };

    request.onupgradeneeded = function(event) {
        db = event.target.result;
        const objectStore = db.createObjectStore("responses", { keyPath: "id", autoIncrement: true });
        objectStore.createIndex("name", "name", { unique: false });
        objectStore.createIndex("time", "time", { unique: false });
    };
}

// Function to add a response to the database
function addResponseToDB(name, response) {
    const transaction = db.transaction(["responses"], "readwrite");
    const objectStore = transaction.objectStore("responses");
    const newResponse = {
        name: name,
        response: response,
        time: new Date().toISOString()
    };

    const request = objectStore.add(newResponse);

    request.onerror = function(event) {
        console.error("Error adding response to database");
    };

    request.onsuccess = function(event) {
        console.log("Response added to database successfully");
    };
}

function metersToPixels(meters) {
    return meters * PIXELS_PER_METER;
}

function pixelsToMeters(pixels) {
    return pixels / PIXELS_PER_METER;
}

function drawBackground() {
    // Sky
    ctx.fillStyle = 'skyblue';
    ctx.fillRect(0, 0, canvas.width, groundLevel);
    
    // Clouds
    ctx.fillStyle = 'white';
    clouds.forEach(cloud => {
        drawCloud(cloud.x, cloud.y, cloud.size);
    });
    
    // House
    drawHouse(houseX, houseY, houseWidth, houseHeight);
    
    // Ground
    ctx.fillStyle = 'limegreen';
    ctx.fillRect(0, groundLevel, canvas.width, canvas.height - groundLevel);
}

function drawCloud(x, y, size) {
    ctx.beginPath();
    ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
    ctx.arc(x + size * 0.35, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
    ctx.arc(x + size * 0.7, y, size * 0.5, 0, Math.PI * 2);
    ctx.fill();
}

function drawHouse(x, y, width, height) {
    if (!houseIntact) return; // Don't draw the house if it's destroyed

    // House body
    ctx.fillStyle = '#FFA07A';
    ctx.fillRect(x, y, width, height);
    
    // Roof
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width / 2, y - height * 0.4);
    ctx.lineTo(x + width, y);
    ctx.closePath();
    ctx.fill();
    
    // Window
    ctx.fillStyle = 'lightblue';
    ctx.fillRect(x + width * 0.2, y + height * 0.2, width * 0.3, height * 0.3);
    
    // Door
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + width * 0.6, y + height * 0.6, width * 0.3, height * 0.4);
}

function drawRuler() {
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.font = '12px Arial';
    
    for (let i = 0; i <= CANVAS_WIDTH_METERS; i += 10) {
        let xPixel = metersToPixels(i);
        ctx.beginPath();
        ctx.moveTo(xPixel, groundLevel);
        ctx.lineTo(xPixel, groundLevel + 10);
        ctx.stroke();
        
        ctx.fillText(i + 'm', xPixel, groundLevel + 25);
    }
}

function drawCannon() {
    let cannonXPixel = metersToPixels(cannonX);
    let cannonYPixel = metersToPixels(cannonY);
    ctx.fillStyle = 'gray';
    ctx.fillRect(cannonXPixel - 20, cannonYPixel - 10, 40, 20);
    
    let angle = angleInput.value * Math.PI / 180;
    ctx.beginPath();
    ctx.moveTo(cannonXPixel, cannonYPixel);
    ctx.lineTo(cannonXPixel + Math.cos(angle) * 40, cannonYPixel - Math.sin(angle) * 40);
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'gray';
    ctx.stroke();
}

function drawBall() {
    let ballXPixel = metersToPixels(ballX);
    let ballYPixel = metersToPixels(ballY);
    ctx.beginPath();
    ctx.arc(ballXPixel, ballYPixel, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'red';
    ctx.fill();
}

function drawTrajectory() {
    if (trajectory.length > 0) {
        ctx.beginPath();
        ctx.setLineDash([5, 5]);
        ctx.moveTo(metersToPixels(trajectory[0].x), metersToPixels(trajectory[0].y));
        for (let point of trajectory) {
            ctx.lineTo(metersToPixels(point.x), metersToPixels(point.y));
        }
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

// Add this new function to create explosion particles
function createExplosion(x, y) {
    for (let i = 0; i < 50; i++) {
        explosionParticles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 10,
            vy: (Math.random() - 0.5) * 10,
            radius: Math.random() * 3 + 1,
            color: `rgb(${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)}, ${Math.floor(Math.random()*255)})`
        });
    }
}

// Add this new function to draw explosion particles
function drawExplosion() {
    explosionParticles.forEach((particle, index) => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fillStyle = particle.color;
        ctx.fill();

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.1; // Add gravity to particles

        if (particle.y > groundLevel) {
            explosionParticles.splice(index, 1);
        }
    });
}

function updateBall() {
    if (isFiring) {
        ballX += velocityX * 0.02;
        ballY += velocityY * 0.02;
        velocityY += gravity * 0.02;

        trajectory.push({x: ballX, y: ballY});

        // Check for collision with the house
        if (houseIntact && 
            ballX > houseX / PIXELS_PER_METER && 
            ballX < (houseX + houseWidth) / PIXELS_PER_METER && 
            ballY > houseY / PIXELS_PER_METER && 
            ballY < (houseY + houseHeight) / PIXELS_PER_METER) {
            houseIntact = false;
            createExplosion(ballX * PIXELS_PER_METER, ballY * PIXELS_PER_METER);
            isFiring = false;
            fireButton.disabled = false;
            let finalDistance = Math.floor(ballX - cannonX);
            addTrialToTable(trialCount, angleInput.value, powerInput.value, finalDistance);
        }

        if (ballY > cannonY) {
            // Calculate the exact x position where the ball hits the ground
            let t = (cannonY - (ballY - velocityY * 0.02)) / (velocityY * 0.02);
            ballX = ballX - velocityX * 0.02 + velocityX * 0.02 * t;
            ballY = cannonY;
            isFiring = false;
            fireButton.disabled = false;
            
            // Calculate final distance when the ball hits the ground
            let finalDistance = Math.floor(ballX - cannonX);
            addTrialToTable(trialCount, angleInput.value, powerInput.value, finalDistance);
        }

        if (ballX > CANVAS_WIDTH_METERS) {
            isFiring = false;
            fireButton.disabled = false;
            
            // If the ball goes off-screen, use the last recorded position
            let finalDistance = Math.floor(CANVAS_WIDTH_METERS - cannonX);
            addTrialToTable(trialCount, angleInput.value, powerInput.value, finalDistance);
        }
    }
}

function drawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();
    drawRuler();
    drawCannon();
    drawTrajectory();
    drawBall();
    drawExplosion();
    
    // Draw title
    ctx.fillStyle = 'black';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Angle, Speed, and Distance', canvas.width / 2, 30);
}

// Modify the gameLoop function to move clouds
function gameLoop() {
    houseY = groundLevel - houseHeight; // Update house Y position
    updateBall();
    
    // Move clouds
    clouds.forEach(cloud => {
        cloud.x += 0.2;
        if (cloud.x > canvas.width + cloud.size) {
            cloud.x = -cloud.size;
        }
    });
    
    drawScene();
    requestAnimationFrame(gameLoop);
}

function fireBall() {
    if (!isFiring) {
        ballX = cannonX;
        ballY = cannonY;
        
        let angle = parseInt(angleInput.value);
        let power = parseInt(powerInput.value);
        let angleRad = angle * Math.PI / 180;
        velocityX = Math.cos(angleRad) * power / 2;
        velocityY = -Math.sin(angleRad) * power / 2;
        isFiring = true;
        trajectory = [{x: ballX, y: ballY}];
        fireButton.disabled = true;
        
        trialCount++;
        houseIntact = true; // Reset the house when firing a new ball
        explosionParticles = []; // Clear any existing explosion particles
    }
}

function addTrialToTable(trial, angle, power, distance) {
    let adjustedDistance = distance; // Add 11 meters to every trial
    let row = trialTableBody.insertRow();
    row.insertCell(0).textContent = trial;
    row.insertCell(1).textContent = angle;
    row.insertCell(2).textContent = power;
    row.insertCell(3).textContent = adjustedDistance + 'm';
}

function clearHistory() {
    trialTableBody.innerHTML = '';
    trialCount = 0;
}

// Modify the submitObservations function
function submitObservations() {
    const observations = observationsTextarea.value.trim();
    const studentName = studentNameInput.value.trim();

    if (!observations || !studentName) {
        alert('Please enter both your observations and your name.');
        return;
    }

    // Add response to the database
    addResponseToDB(studentName, observations);

    // Prepare CSV data
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Student Name,Observations\n';
    csvContent += `"${studentName}","${observations}"\n\n`;
    csvContent += 'Trial,Angle,Power,Distance\n';

    // Add trial data
    const rows = trialTableBody.getElementsByTagName('tr');
    for (let row of rows) {
        const cells = row.getElementsByTagName('td');
        const rowData = Array.from(cells).map(cell => cell.textContent);
        csvContent += rowData.join(',') + '\n';
    }

    // Create and trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${studentName}_observations.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clear form fields
    observationsTextarea.value = '';
    studentNameInput.value = '';

    alert('Your response has been submitted and saved!');
}

fireButton.addEventListener('click', fireBall);

angleInput.addEventListener('input', () => {
    angleValue.textContent = angleInput.value;
});

powerInput.addEventListener('input', () => {
    powerValue.textContent = powerInput.value;
});

clearHistoryButton.addEventListener('click', clearHistory);

// Add event listener for the submit button
submitObservationsButton.addEventListener('click', submitObservations);

fireButton.disabled = false;

// Initialize the database when the page loads
document.addEventListener('DOMContentLoaded', initDB);

gameLoop();