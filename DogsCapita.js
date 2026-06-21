let dogData = null; //dog data per district
let capitaData = null;

const DISTRICT_NAMES = {
    90100: "Innere Stadt",
    90200: "Leopoldstadt",
    90300: "Landstraße",
    90400: "Wieden",
    90500: "Margareten",
    90600: "Mariahilf",
    90700: "Neubau",
    90800: "Josefstadt",
    90900: "Alsergrund",
    91000: "Favoriten",
    91100: "Simmering",
    91200: "Meidling",
    91300: "Hietzing",
    91400: "Penzing",
    91500: "Rudolfsheim-Fünfhaus",
    91600: "Ottakring",
    91700: "Hernals",
    91800: "Währing",
    91900: "Döbling",
    92000: "Brigittenau",
    92100: "Floridsdorf",
    92200: "Donaustadt",
    92300: "Liesing"
};

//load dogs per district
function loadDogData() {
    return d3.dsv(";", "data/hunde-wien.csv")
        .then(data => {
            return data;
        })
}

//load population data per district
function loadCapitaData() {
    return d3.text("data/Bev_Zeitreihe_Jahresbeginn_Gebietseinheiten.csv")
        .then(text => {
            const lines = text.split('\n');
            const map = new Map();
            for (let i = 147; i < 170; i++) {
                const parts = lines[i].split(';');
                const districtCode = parseInt(parts[0]) * 100;
                const inhabitants = parseFloat(parts[26]);
                map.set(districtCode, inhabitants);
            }
            return map;
        });
}

//get district label from district number (90100 -> 1.)
function getDistrictLabel(code) {
    return parseInt(String(code).slice(1, 3)) + ".";
}

function drawCapitaChart(dogsData) {
    //groups dogs per district
    const dogsByDistrict = d3.group(dogsData, r => +r.DISTRICT_CODE);
    const districtData = [];

    const districtBreedRatioMap = new Map();

    //get total number of dogs per district
    for (const [code, rows] of dogsByDistrict) {
        const totalCount = d3.sum(rows, r => +r.Anzahl);
        const population = capitaData.get(code);
        const dogsPerInhabitants = (totalCount / population) * 1000;

        districtData.push({
            district: code,
            inhabitants: population,
            dogsPerInhabitants: dogsPerInhabitants
        })
    }

    // create chart
    const margin = { top: 40, right: 80, bottom: 60, left: 80 };
    const width = 900;
    const height = 650;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select("#capita-chart-svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "white")
        .style("border-radius", "8px");

    svg.selectAll("*").remove();

    //translate by 80px and 40px (margin)
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    //x-axis (inhabitants)
    const xScale = d3.scaleLinear()
        .domain([0, d3.max(districtData, d => d.inhabitants) * 1.15])
        .range([0, innerW]);

    // y-axis (dogs per 1000 inhabitants = density)
    const yScale = d3.scaleLinear()
        .domain([0, d3.max(districtData, d => d.dogsPerInhabitants) * 1.15])
        .range([innerH, 0]);

    //grid horizontal
    const yAxisGrid = d3.axisLeft(yScale)
        .ticks(8)
        .tickSize(-innerW)
        .tickFormat("");

    const gridGroupY = g.append("g")
        .attr("class", "grid")
        .style("color", "#e0e0e0")
        .style("stroke-dasharray", "3,3");

    yAxisGrid(gridGroupY);

    //grid vertikal
    const xAxisGrid = d3.axisBottom(xScale)
        .ticks(10)
        .tickSize(-innerH)
        .tickFormat("");

    const gridGroupX = g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${innerH})`)
        .style("color", "#e0e0e0")
        .style("stroke-dasharray", "3,3");

    xAxisGrid(gridGroupX);

    // Axis description
    const xAxis = d3.axisBottom(xScale)
        .ticks(10)
        .tickFormat(d3.format(".0f"));

    const xAxisGroup = g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .style("font-size", "12px")
        .style("font-weight", "500");

    xAxis(xAxisGroup);

    const yAxis = d3.axisLeft(yScale)
        .ticks(8)
        .tickFormat(d3.format(".1f"));

    const yAxisGroup = g.append("g")
        .style("font-size", "12px")
        .style("font-weight", "500");

    yAxis(yAxisGroup);

    // x-axis label
    g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 45)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("Number of Citizens per District");

    // y-axis label - HIER: -innerH/2, nicht -height/2!
    g.append("text")
        .attr("x", -innerH / 2)
        .attr("y", -65)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .attr("transform", "rotate(-90)")
        .text("Number of Dogs per 1000 Citizens");

    //bubbles
    g.selectAll("circle")
        .data(districtData)
        .enter()
        .append("circle")
        .attr("cx", d => xScale(d.inhabitants))
        .attr("cy", d => yScale(d.dogsPerInhabitants))
        .attr("r", 16)
        .style("fill", "#e05c7a")
        .style("opacity", 0.8)
        .style("stroke", "white")
        .style("stroke-width", 2)
        .style("cursor", "pointer")
        .on("mousemove", function (event, d) {
            tooltip
                .style("display", "block")
                .style("left", (event.pageX + 12) + "px")
                .style("top", (event.pageY - 28) + "px")
                .text(DISTRICT_NAMES[d.district] || getDistrictLabel(d.district));
        })
        .on("mouseout", function () {
            tooltip.style("display", "none");
        });

    //bubble-labels (district numbers)
    g.selectAll("text.circle-label")
        .data(districtData)
        .enter()
        .append("text")
        .attr("class", "circle-label")
        .attr("x", d => xScale(d.inhabitants))
        .attr("y", d => yScale(d.dogsPerInhabitants))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central") // Zentriert vertikal
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("fill", "black")
        .style("pointer-events", "none")
        .text(d => getDistrictLabel(d.district));
}


//load dog-data & capita-data
Promise.all([loadDogData(), loadCapitaData()])
    .then(([dogDataLoaded, capitaDataLoaded]) => {
        dogData = dogDataLoaded;
        capitaData = capitaDataLoaded;

        //draw chart
        drawCapitaChart(dogData);
    })
    .catch(error => {
        console.error("Error loading data:", error);
        d3.select("#apartment-chart-title").text("Error loading data");
    });