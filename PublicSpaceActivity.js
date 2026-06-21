let dogsActivity = null; //dog characteristics
let publicSpaceMap = null;

const ENERGY_MAP = {
    "Couch Potatoe": 0,
    "Calm": 0.25,
    "Regular Exercise": 0.5,
    "Energetic": 0.75,
    "Needs Lots of Activity": 1.0
};

const ENERGY_LABELS = ["Very Low", "Low", "Medium", "High", "Very High"];

function getEnergyLabel(value) {
    if (value <= 0.2) return "Very Low";
    if (value <= 0.4) return "Low";
    if (value <= 0.6) return "Medium";
    if (value <= 0.8) return "High";
    return "Very High";
}

//load public-space data (district number, hundezone, auslauffläche)
function loadPublicSpaceData() {
    return d3.text("data/tab_4.3.2_freizeitundsport_.csv")
        .then(text => {
            const lines = text.split('\n');
            const map = new Map();
            for (let i = 6; i < 29; i++) {
                const parts = lines[i].split(';');
                const districtCode = parseInt(parts[1]);
                const dogZones = parseFloat(parts[4].replace(',', '.'));
                const dogArea = parseFloat(parts[6].replace(',', '.'));
                map.set(districtCode, {
                    dogZones: dogZones,
                    dogArea: dogArea,
                    total: dogZones + dogArea
                });
            }
            return map;
        });
}

//draw chart
function drawActivityChart(data) {
    //groupds dogs per district
    const dogsByDistrict = d3.group(data, r => +r.DISTRICT_CODE);
    const districtData = [];

    //only get pureBred dogs since characteristics only exist for them, per district
    for (const [code, rows] of dogsByDistrict) { //bezirkscode, dog-entries
        const totalAllDogs = d3.sum(rows, r => +r.Anzahl); //needed for bubble-size
        const pure = rows.filter(r => {
            const b = r["Dog Breed"] || ""; //get breed name
            return !b.includes("/") && b !== "Unbekannt" && !b.includes("Mischling") && !b.toLowerCase().includes("mix");
        });

        //get top 5, rollup: group data (if there are any with the same name)
        const counts = d3.rollup(pure, v => d3.sum(v, r => +r.Anzahl), r => r["Dog Breed"]);
        const top5 = Array.from(counts, ([breed, count]) => ({ breed, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);


        //see if top5 dog match characteristics csv, get details
        let totalEnergy = 0;
        let totalCount = 0;
        const details = [];
        for (const { breed, count } of top5) {
            const match = findDogBreed(breed, dogSizeData);
            if (match) {
                const energyValue = ENERGY_MAP[match.energyCategory];
                totalEnergy += energyValue * count;
                totalCount += count;
                details.push({
                    breed,
                    energy: getEnergyLabel(energyValue)
                });
            }
        }

        //add all the data to districtData (living space, dog data)
        const publicSpace = publicSpaceMap.get(code);
        const avgEnergyValue = totalEnergy / totalCount;
        const avgEnergyLabel = getEnergyLabel(avgEnergyValue);
        districtData.push({
            district: code,
            name: DISTRICT_NAMES[code],
            avgEnergyValue: avgEnergyValue,
            avgEnergyLabel: avgEnergyLabel,
            totalDogs: totalAllDogs,
            dogZones: publicSpace.dogZones,
            dogArea: publicSpace.dogArea,
            areaTotal: publicSpace.total,
            topBreeds: details
        });
    }

    //sort: data with less avgHeight gets drawn first
    districtData.sort((a, b) => a.avgEnergyValue - b.avgEnergyValue);

    //setup chart
    const margin = { top: 40, right: 80, bottom: 60, left: 80 };
    const width = 900, height = 650;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select("#activity-chart-svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "white")
        .style("border-radius", "8px");

    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    //x-axis (sqrt for better distribution)
    const maxArea = d3.max(districtData, d => d.areaTotal);
    const x = d3.scaleSqrt()
        .domain([0, maxArea * 1.1])
        .range([0, innerW]);

    //y-axis (average activity level of top 5 dogs)
    const yMin = 0.4;
    const yMax = 0.9;
    const y = d3.scaleLinear()
        .domain([yMin, yMax])
        .range([innerH, 0]);

    //bubble-size: determined by number of dogs in the district
    const r = d3.scaleSqrt()
        .domain([0, d3.max(districtData, d => d.totalDogs)])
        .range([8, 40]);

    //background-net for better readability
    g.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y)
            .ticks(6)
            .tickSize(-innerW)
            .tickFormat("")
        )
        .style("color", "#e0e0e0")
        .style("stroke-dasharray", "3,3");

    g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x)
            .tickValues([0, 1000, 2500, 5000, 10000, 15000, 20000, 30000, 40000, 50000, 100000, 200000, 400000])
            .tickSize(-innerH)
            .tickFormat("")
        )
        .style("color", "#e0e0e0")
        .style("stroke-dasharray", "3,3");

    //axis descriptions
    g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x)
            .tickValues([0, 1000, 2500, 5000, 10000, 15000, 20000, 30000, 40000, 50000, 100000, 200000, 400000])
            .tickFormat(d => {
                return (d / 1000) + "k";
            })
        )
        .style("font-size", "12px")
        .style("font-weight", "500");

    g.append("g")
        .call(d3.axisLeft(y)
            .ticks(6)
            .tickFormat(d => d.toFixed(1))
        )
        .style("font-size", "12px")
        .style("font-weight", "500");

    //axis-general description
    g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 45)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text("Average public Dog Space (in 1000 m²)");

    g.append("text")
        .attr("x", -innerH / 2)
        .attr("y", -65)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .attr("transform", "rotate(-90)")
        .text("Average Dog Activity Level");

    //Tooltip, to display data per district (dog details)
    const tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("display", "none")
        .style("position", "absolute")
        .style("background", "#f0a500")
        .style("color", "white")
        .style("padding", "12px 16px")
        .style("border-radius", "8px")
        .style("font-size", "13px")
        .style("max-width", "280px")
        .style("line-height", "1.6")

    //place circles (per district)
    g.selectAll("circle")
        .data(districtData)
        .join("circle")
        .attr("cx", d => x(d.areaTotal))
        .attr("cy", d => y(d.avgEnergyValue))
        .attr("r", d => r(d.totalDogs))
        .attr("stroke", "white")
        .attr("fill", "#e05c7a")
        .attr("stroke-width", 2.5)
        .style("opacity", 0.85)
        .style("transition", "all 0.2s")
        .on("mouseover", function (e, d) {
            d3.select(this)
                .style("opacity", 1)
                .attr("stroke", "#f0a500")
                .attr("stroke-width", 4) //orange stroke around bubble
                .attr("r", r(d.totalDogs) * 1.1);

            //html-description for top 5 dogs within tooltip, breed + cm
            const breeds = d.topBreeds.slice(0, 5).map(b =>
                `${b.breed}: ${b.energy}`
            ).join("<br>");

            //tooltip text (will be shown when hovering over bubble)
            tooltip
                .style("display", "block")
                .html(`
                    <strong style="font-size: 15px; color: black;">${d.name}</strong><br>
                    <hr style="margin: 4px 0; border-color: rgba(255,255,255,0.4);">
                    <strong>Avg Activity Level (pure, Top 5):</strong> ${d.avgEnergyValue.toFixed(2)}, ${d.avgEnergyLabel}<br>
                    <strong>Public Dog Zones:</strong> ${d.dogZones.toFixed(1)} m²<br>
                    <strong>Public Off-Leash Areas:</strong> ${d.dogArea.toFixed(1)} m²<br>
                    <strong>Total Dogs (all):</strong> ${d.totalDogs}<br>
                    <hr style="margin: 4px 0; border-color: rgba(255,255,255,0.4);">
                    <strong>Top 5 Breeds (pure) & Avg Activity Level:</strong><br>
                    ${breeds}
                `);
        })
        .on("mousemove", function (e) {
            tooltip
                .style("left", (e.pageX + 18) + "px")
                .style("top", (e.pageY - 10) + "px");
        })
        .on("mouseout", function () { //change bubble-opacity and stroke back to normal
            d3.select(this)
                .style("opacity", 0.85)
                .attr("stroke", "white")
                .attr("stroke-width", 2.5)
                .attr("r", r(d3.select(this).datum().totalDogs));
            tooltip.style("display", "none");
        });

    //get district label from district number (90100 -> 1.)
    function getDistrictLabel(code) {
        return parseInt(String(code).slice(1, 3)) + ".";
    }

    //label bubbles (with district number)
    g.selectAll("text.label")
        .data(districtData)
        .join("text")
        .attr("class", "label")
        .attr("x", d => x(d.areaTotal))
        .attr("y", d => y(d.avgEnergyValue - 0.004))
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "black")
        .style("font-weight", "bold")
        .text(d => getDistrictLabel(d.district));
}

//load data
Promise.all([loadPublicSpaceData()])
    .then(([loadPublicSpaceData]) => {
        publicSpaceMap = loadPublicSpaceData;
        //draw chart, but wait for previous chart to be completed (for re-using data)
        setTimeout(() => {
            if (dogData && dogData != null &&
                dogSizeData && dogSizeData != null &&
                publicSpaceMap && publicSpaceMap != null) {
                drawActivityChart(dogData);
            } else {
                d3.select("#activity-chart-svg").html("<text>Error: data not loaded</text>");
            }
        }, 500);
    })

    .catch(error => {
        console.error("Error loading data:", error);
        d3.select("#activity-chart-title").text("Error loading data");
    });