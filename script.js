/* -----------------------------------------
   IN-STORE NAVIGATION SYSTEM – SCRIPT.JS
   Features:
   - Multi-floor map switching
   - Item list + multiple selection
   - Shortest path (simple BFS)
   - Current location → destination
   - Voice guidance
   - Language switch (EN / KN / HI)
   - Shopkeeper edit mode
   - Star ratings + discounts
----------------------------------------- */

const state = {
    currentFloor: 1,
    currentLocation: null,
    destination: null,
    selectedItems: [],
    language: "en",
    editMode: false
};

// ---------------------------------------
// LANGUAGE PACK
// ---------------------------------------
const lang = {
    en: {
        title: "In-Store Navigation",
        open: "Mall opens at 9:00 AM",
        close: "Mall closes at 10:00 PM",
        navigate: "Start Navigation",
        selectItem: "Select an item",
        floor: "Floor",
        from: "Current Location",
        to: "Destination",
        noPath: "No path found!",
        startNav: "Starting navigation to",
        arrived: "You have reached your destination.",
    },
    kn: {
        title: "ದುಕಾನ ನ್ಯಾವಿಗೇಶನ್",
        open: "ಮಾಲ್ ಬೆಳಿಗ್ಗೆ 9:00 ಕ್ಕೆ ತೆರೆಯಲಾಗುತ್ತದೆ",
        close: "ಮಾಲ್ ರಾತ್ರಿ 10:00 ಕ್ಕೆ ಮುಚ್ಚಲಾಗುತ್ತದೆ",
        navigate: "ನೇವಿಗೆಟ್ ಪ್ರಾರಂಭಿಸಿ",
        selectItem: "ಐಟಂ ಆಯ್ಕೆಮಾಡಿ",
        floor: "ಮಹಡಿ",
        from: "ಪ್ರಸ್ತುತ ಸ್ಥಳ",
        to: "ಗಮ್ಯಸ್ಥಾನ",
        noPath: "ಮಾರ್ಗ ಕಂಡುಬಂದಿಲ್ಲ!",
        startNav: "ನ್ಯಾವಿಗೇಶನ್ ಪ್ರಾರಂಭವಾಗಿದೆ →",
        arrived: "ನೀವು ಗಮ್ಯಸ್ಥಾನ ತಲುಪಿದ್ದೀರಿ.",
    },
    hi: {
        title: "स्टोर नेविगेशन",
        open: "मॉल सुबह 9:00 बजे खुलता है",
        close: "मॉल रात 10:00 बजे बंद होता है",
        navigate: "नेविगेशन शुरू करें",
        selectItem: "आइटम चुनें",
        floor: "मंज़िल",
        from: "वर्तमान स्थान",
        to: "गंतव्य",
        noPath: "रास्ता नहीं मिला!",
        startNav: "नेविगेशन शुरू →",
        arrived: "आप गंतव्य पर पहुँच गए हैं.",
    }
};

// ---------------------------------------
// FLOOR MAPS – SAMPLE BLOCK LAYOUT
// ---------------------------------------
const floors = {
    1: {
        nodes: ["Entrance", "MallOffice", "Billing", "Lift", "Stairs", "Escalator", "Exit"],
        edges: {
            "Entrance": ["MallOffice", "Lift"],
            "MallOffice": ["Billing"],
            "Lift": ["Stairs", "Escalator"],
            "Stairs": ["Exit"],
            "Escalator": ["Billing"],
            "Billing": ["Exit"]
        }
    },
    2: {
        nodes: ["Grocery", "Clothing", "Lift", "Stairs", "Escalator", "WashroomMen", "WashroomWomen"],
        edges: {
            "Grocery": ["Lift", "Stairs"],
            "Clothing": ["Lift", "Escalator"],
            "Lift": ["WashroomMen", "Stairs"],
            "Stairs": ["WashroomWomen"],
            "Escalator": ["WashroomMen"]
        }
    },
    3: {
        nodes: ["Electronics", "Movies", "Lift", "Escalator", "Stairs", "WashroomMen", "WashroomWomen"],
        edges: {
            "Electronics": ["Lift"],
            "Movies": ["Escalator"],
            "Lift": ["Stairs"],
            "Escalator": ["WashroomMen"],
            "WashroomMen": ["WashroomWomen"]
        }
    }
};

// ---------------------------------------
// SIMPLE BFS SHORTEST PATH
// ---------------------------------------
function findShortestPath(floor, start, end) {
    const map = floors[floor];
    if (!map.nodes.includes(start) || !map.nodes.includes(end)) return null;

    const queue = [[start]];
    const visited = new Set([start]);

    while (queue.length > 0) {
        const path = queue.shift();
        const node = path[path.length - 1];

        if (node === end) return path;

        for (const neighbor of (map.edges[node] || [])) {
            if (!visited.has(neighbor)) {
                visited.add(neighbor);
                queue.push([...path, neighbor]);
            }
        }
    }
    return null;
}

// ---------------------------------------
// RENDER MAP
// ---------------------------------------
function loadFloor(floor) {
    state.currentFloor = floor;
    document.getElementById("floor-title").innerText = `${lang[state.language].floor} ${floor}`;

    const map = document.getElementById("map");
    map.innerHTML = "";

    floors[floor].nodes.forEach(node => {
        const div = document.createElement("div");
        div.className = "node";
        div.innerText = node;
        div.onclick = () => selectLocation(node);
        map.appendChild(div);
    });
}

function selectLocation(node) {
    if (!state.currentLocation) {
        state.currentLocation = node;
        alert(`${lang[state.language].from}: ${node}`);
    } else {
        state.destination = node;
        alert(`${lang[state.language].to}: ${node}`);
    }
}

// ---------------------------------------
// START NAVIGATION
// ---------------------------------------
function navigate() {
    if (!state.currentLocation || !state.destination) {
        alert("Select current location and destination first");
        return;
    }

    const path = findShortestPath(state.currentFloor, state.currentLocation, state.destination);

    if (!path) {
        alert(lang[state.language].noPath);
        return;
    }

    speak(`${lang[state.language].startNav} ${state.destination}`);

    animateNavigation(path);
}

// ---------------------------------------
// MOVING PERSON ANIMATION (Simple)
// ---------------------------------------
function animateNavigation(path) {
    let index = 0;

    const interval = setInterval(() => {
        highlightNode(path[index]);

        if (index === path.length - 1) {
            clearInterval(interval);
            speak(lang[state.language].arrived);
        }
        index++;
    }, 1200);
}

function highlightNode(name) {
    const nodes = document.querySelectorAll(".node");
    nodes.forEach(n => {
        if (n.innerText === name) {
            n.style.background = "#3b82f6";
            n.style.color = "#fff";
        } else {
            n.style.background = "#e5e7eb";
            n.style.color = "#000";
        }
    });
}

// ---------------------------------------
// VOICE OUTPUT
// ---------------------------------------
function speak(text) {
    const msg = new SpeechSynthesisUtterance(text);
    msg.lang = (state.language === "kn" ? "kn-IN" :
               state.language === "hi" ? "hi-IN" : "en-US");
    speechSynthesis.speak(msg);
}

// ---------------------------------------
// LANGUAGE SWITCHING
// ---------------------------------------
function setLanguage(l) {
    state.language = l;
    document.getElementById("title").innerText = lang[l].title;
    document.getElementById("open-time").innerText = lang[l].open;
    document.getElementById("close-time").innerText = lang[l].close;
    loadFloor(state.currentFloor);
}

// ---------------------------------------
// SHOPKEEPER EDIT MODE
// ---------------------------------------
function toggleEditMode() {
    state.editMode = !state.editMode;
    alert(state.editMode ? "Edit mode ON (shopkeeper)" : "Edit mode OFF");
}

// ---------------------------------------
// INITIALIZE
// ---------------------------------------
window.onload = () => {
    loadFloor(1);
    setLanguage("en");
};
