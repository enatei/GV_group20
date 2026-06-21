let currentSocialParam = 'income';
let currentBreedRatio = 'pure';
let incomeData = null;
let educationData = null;
let ageData = null;

function loadIncomeData() {
    return d3.dsv(";", "data/Durchschnittliches_Nettoeinkommen_in_Wien.csv")
        .then(data => {
            const newestData = data.filter(row => row.Jahr === "2023");

            const incomeMap = new Map();
            newestData.forEach(row => {
                const code = row["Geo-ID"]
                const income = parseFloat(row["Nettoeinkommen"]);
                if (code != "90000") {
                    incomeMap.set(code, income);
                }
            })
            return incomeMap;
        })
}

function loadEducationData() {
    return d3.dsv(";", "data/Bildungsstand_der_Bevölkerung_in_Wien.csv")
        .then(data => {
            const newestData = data.filter(row => row.Jahr === "2023");

            const educationMap = new Map();
            newestData.forEach(row => {
                const code = row["Geo-ID"]
                if (code != "Wien") {
                    educationMap.set(code, {
                        pflichtschule: parseFloat(row["Pflichtschule*"]),
                        lehre: parseFloat(row["Lehre"]),
                        bms: parseFloat(row["BMS"]),
                        ahs: parseFloat(row["AHS"]),
                        bhs: parseFloat(row["BHS"]),
                        kolleg: parseFloat(row["Kolleg"]),
                        akademiker: parseFloat(row["AkademikerInnen"])
                    });
                }
            });
            return educationMap;
        });
}

//get weighted mean value
function getEducationScore(data) {
    return (
        data.pflichtschule * 1 +
        data.lehre * 2 +
        data.bms * 3 +
        data.ahs * 4 +
        data.bhs * 4 +
        data.kolleg * 5 +
        data.akademiker * 6
    ) / 100;
}

function loadAgeData() {
    return d3.dsv(";", "data/Durchschnittsalter_der_Bevölkerung_in_Wien.csv")
        .then(data => {
            const newestData = data.filter(row => row.Jahr === "2025");

            const ageMap = new Map();
            newestData.forEach(row => {
                const code = row["Geo-ID"]
                const age = parseFloat(row["Durchschnittsalter"].replace(',', '.'));
                if (code != "Wien") {
                    ageMap.set(code, age);
                }
            })
            return ageMap;
        })
}

function drawSocioChart(dogsData) {
    //groups dogs per district
    const dogsByDistrict = d3.group(dogsData, r => +r.DISTRICT_CODE);
    const districtData = [];

    //get pure and mixed dogs ratio per district
    for (const [code, rows] of dogsByDistrict) {
        const totalCount = d3.sum(rows, r => +r.Anzahl);

        const isPure = r => {
            const b = (r["Dog Breed"] || "").toLowerCase().trim();
            return !b.includes("/") &&
                b !== "unbekannt" &&
                !b.includes("mischling") &&
                !b.includes("mix");
        };
        const pureCount = d3.sum(rows, r => isPure(r) ? +r.Anzahl : 0);
        const mixedCount = totalCount - pureCount;
        const pureBreedRatio = ((pureCount / totalCount) * 100).toFixed(2);
        const mixedBreedRatio = ((mixedCount / totalCount) * 100).toFixed(2);

        let socialValue;
        let socialLabel;
        switch (currentSocialParam) {
            case 'income':
                socialValue = incomeData.get(String(code));
                socialLabel = 'Monthly Net Income (€)';
                break;
            case 'education':
                socialValue = getEducationScore(educationData.get(String(code)));
                socialLabel = 'Education Level (1-6)';
                break;
            case 'age':
                socialValue = ageData.get(String(code));
                socialLabel = 'Average Age (years)';
                break;
            default:
                socialValue = incomeData.get(String(code));
                socialLabel = 'Monthly Net Income (€)';
        }

        let breedRatio = currentBreedRatio === 'pure' ? pureBreedRatio : mixedBreedRatio;
        let breedLabel = currentBreedRatio === 'pure' ? 'Pure Breeds (%)' : 'Mixed Breeds (%)';

        districtData.push({
            district: code,
            socialValue: socialValue,
            breedRatio: breedRatio,
            socialLabel: socialLabel,
            breedLabel: breedLabel
        });
    }

    //create chart
    const margin = { top: 40, right: 80, bottom: 60, left: 80 };
    const width = 900;
    const height = 550;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select("#socioeconomic-chart-svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "white")
        .style("border-radius", "8px");

    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    //scales values
    let xMin = d3.min(districtData, d => d.socialValue) * 0.95;
    let xMax = d3.max(districtData, d => d.socialValue) * 1.05;

    if (currentSocialParam == 'age') {
        xMin = 38;
        xMax = 48;

    }
    const xScale = d3.scaleLinear()
        .domain([xMin, xMax])
        .range([0, innerW]);

    //zoom into graph
    let min = 0;
    let max = 0;

    if (currentBreedRatio == 'pure') {
        max = 68;
        min = 58;
    } else {
        max = 42;
        min = 32;
    }
    const yScale = d3.scaleLinear()
        .domain([min, max])
        .range([innerH, 0]);

    //grid horizontally
    const yAxisGrid = d3.axisLeft(yScale)
        .ticks(5)
        .tickSize(-innerW)
        .tickFormat("");

    const gridGroupY = g.append("g")
        .attr("class", "grid")
        .style("color", "#e0e0e0")
        .style("stroke-dasharray", "3,3");

    //grid vertically
    yAxisGrid(gridGroupY);

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

    //axes description
    const xAxis = d3.axisBottom(xScale)
        .ticks(10)
        .tickFormat(d3.format(".0f"));

    if (currentSocialParam === 'education') {
        xAxis.tickValues([3.0, 4.0, 5.0]);
    }

    const xAxisGroup = g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .style("font-size", "12px")
        .style("font-weight", "500");

    xAxis(xAxisGroup);

    const yAxis = d3.axisLeft(yScale)
        .ticks(5)
        .tickFormat(d => d + "%");

    const yAxisGroup = g.append("g")
        .style("font-size", "12px")
        .style("font-weight", "500");

    yAxis(yAxisGroup);

    //axis-labels
    const labelX = districtData[0].socialLabel;
    const labelY = districtData[0].breedLabel;

    g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 45)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text(labelX);

    g.append("text")
        .attr("x", -innerH / 2)
        .attr("y", -65)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .attr("transform", "rotate(-90)")
        .text(labelY);

    //bubbles
    const r = d3.scaleSqrt()
        .domain([0, d3.max(districtData, d => d.totalDogs)])
        .range([8, 35]);

    //move a bit to the side for district 16 & 23, if education is selected (due to readability)
    g.selectAll("circle")
        .data(districtData)
        .enter()
        .append("circle")
        .attr("cx", d => {
            let jitter = 0;
            if (currentSocialParam === 'education') {
                if (d.district === 91600) jitter = 0.015;
                if (d.district === 92300) jitter = -0.015;
            }
            return xScale(d.socialValue + jitter);
        })
        .attr("cy", d => yScale(d.breedRatio))
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

    //labels (district numbers)
    g.selectAll("text.circle-label")
        .data(districtData)
        .enter()
        .append("text")
        .attr("class", "circle-label")
        .attr("x", d => {
            let jitter = 0;
            if (currentSocialParam === 'education') {
                if (d.district === 91600) jitter = 0.015;
                if (d.district === 92300) jitter = -0.015;
            }
            return xScale(d.socialValue + jitter);
        })
        .attr("y", d => yScale(d.breedRatio))
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "central")
        .style("font-size", "10px")
        .style("font-weight", "bold")
        .style("fill", "black")
        .style("pointer-events", "none")
        .text(d => getDistrictLabel(d.district));
}

function updateSocioChart(dogsData) {
    drawSocioChart(dogsData);
}

//load income, education, age data
Promise.all([loadIncomeData(), loadEducationData(), loadAgeData()])
    .then(([incomeDataLoaded, educationDataLoaded, ageDataLoaded]) => {
        incomeData = incomeDataLoaded;
        educationData = educationDataLoaded;
        ageData = ageDataLoaded;

        //draw chart
        drawSocioChart(dogData);
    })
    .catch(error => {
        console.error("Error loading data:", error);
        d3.select("#apartment-chart-title").text("Error loading data");
    });

//event listeners for radio buttons (socio param & breed)
d3.selectAll('input[name="socio-param"]').on("change", function () {
    currentSocialParam = this.value;
    updateSocioChart(dogData);
});

d3.selectAll('input[name="breed"]').on("change", function () {
    currentBreedRatio = this.value;
    updateSocioChart(dogData);
});