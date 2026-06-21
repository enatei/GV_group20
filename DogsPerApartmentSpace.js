const INCH_TO_CM = 2.54;
let dogSizeData = null; //dog characteristics
let livingSpaceMap = null;

//load apartment-space data (district number and m2)
function loadApartmentData() {
    return d3.text("data/tab-2-2-3-wohnu.csv")
        .then(text => {
            const lines = text.split('\n');
            const map = new Map();
            for (let i = 6; i < 29; i++) {
                const parts = lines[i].split(';');
                const districtCode = parseInt(parts[1]);
                const livingSpace = parseFloat(parts[6]);
                map.set(districtCode, livingSpace);
            }
            return map;
        });
}

//load dog characteristics
function loadDogSizeData() {
    return d3.dsv(";", "data/akc-data-latest-selected-columns.csv", d3.autoType)
        .then(data => {
            const result = data
                .map(d => ({
                    nameGerman: d.Deutsch || d.English,
                    nameEnglish: d.English,
                    avgHeightCm: ((d.min_height || 0) + (d.max_height || 0)) / 2 * INCH_TO_CM,
                    energyCategory: d.energy_level_category || "Unknown"
                }));
            return result;
        });
}

//find dog breeds within dog characteristics
function findDogBreed(name, data) {
    const search = name.toLowerCase();

    let match = data.find(d => d.nameGerman.toLowerCase() === search);
    if (match) return match;

    match = data.find(d => d.nameEnglish.toLowerCase() === search);
    if (match) return match;

    match = data.find(d => d.nameGerman.toLowerCase().includes(search));
    if (match) return match;

    match = data.find(d => d.nameEnglish.toLowerCase().includes(search));
    if (match) return match;

    return null;
}

//draw chart
function drawChart(dogsData) {
    //groupds dogs per district
    const dogsByDistrict = d3.group(dogsData, r => +r.DISTRICT_CODE);
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
        let totalHeight = 0;
        let totalCount = 0;
        details = [];
        for (const { breed, count } of top5) {
            const match = findDogBreed(breed, dogSizeData);
            if (match) {
                totalHeight += match.avgHeightCm * count;
                totalCount += count;
                details.push({
                    breed,
                    height: match.avgHeightCm
                });
            }
        }

        //add all the data to districtData (living space, dog data)
        const livingSpace = livingSpaceMap.get(code);
        districtData.push({
            district: code,
            name: DISTRICT_NAMES[code],
            avgHeight: totalHeight / totalCount,
            totalDogs: totalAllDogs,
            livingSpace: livingSpace,
            topBreeds: details
        });
    }

    //sort: data with less avgHeight gets drawn first
    districtData.sort((a, b) => a.avgHeight - b.avgHeight);

    //setup chart
    const margin = { top: 40, right: 80, bottom: 60, left: 80 };
    const width = 900;
    const height = 650;
    const innerW = width - margin.left - margin.right;
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select("#apartment-chart-svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "white")
        .style("border-radius", "8px");

    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    //x-axis (m2 of apartment-size)
    const xMin = 55;
    const xMax = 110;
    const x = d3.scaleLinear()
        .domain([xMin, xMax])
        .range([0, innerW]);

    //y-axis (cm of average dog size (top 5 dogs))
    const yMin = 60;
    const yMax = 115;
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
            .ticks(8)
            .tickSize(-innerW)
            .tickFormat("")
        )
        .style("color", "#e0e0e0")
        .style("stroke-dasharray", "3,3");

    g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x)
            .ticks(12)
            .tickSize(-innerH)
            .tickFormat("")
        )
        .style("color", "#e0e0e0")
        .style("stroke-dasharray", "3,3");

    //axis descriptions
    g.append("g")
        .attr("transform", `translate(0,${innerH})`)
        .call(d3.axisBottom(x)
            .ticks(12)
            .tickFormat(d => d + " m²")
        )
        .style("font-size", "12px")
        .style("font-weight", "500");

    g.append("g")
        .call(d3.axisLeft(y)
            .ticks(8)
            .tickFormat(d => d + " cm")
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
        .text("Average Apartment Space (m²)");

    g.append("text")
        .attr("x", -innerH / 2)
        .attr("y", -65)
        .attr("text-anchor", "middle")
        .style("font-size", "15px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .attr("transform", "rotate(-90)")
        .text("Average Dog Height (cm)");

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
        .attr("cx", d => x(d.livingSpace))
        .attr("cy", d => {
            if (d.district == 91400) {
                return y(d.avgHeight + 0.5)
            } else if (d.district == 90300) {
                return y(d.avgHeight - 0.5)
            } else {
                return y(d.avgHeight)
            }
        })
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
                `${b.breed}: ${b.height.toFixed(1)} cm`
            ).join("<br>");

            //tooltip text (will be shown when hovering over bubble)
            tooltip
                .style("display", "block")
                .html(`
                    <strong style="font-size: 15px; color: black;">${d.name}</strong><br>
                    <hr style="margin: 4px 0; border-color: rgba(255,255,255,0.4);">
                    <strong>Avg Dog Height (pure, Top 5):</strong> ${d.avgHeight.toFixed(1)} cm<br>
                    <strong>Avg Apartment Space:</strong> ${d.livingSpace} m²<br>
                    <strong>Total Dogs (all):</strong> ${d.totalDogs}<br>
                    <hr style="margin: 4px 0; border-color: rgba(255,255,255,0.4);">
                    <strong>Top 5 Breeds (pure) & Avg Height:</strong><br>
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
        .attr("x", d => x(d.livingSpace))
        .attr("y", d => {
            if (d.district == 91400) {
                return y(d.avgHeight + 0.5) + 4
            } else if (d.district == 90300) {
                return y(d.avgHeight - 0.5) + 4
            } else {
                return y(d.avgHeight) + 4
            }
        })
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "black")
        .style("font-weight", "bold")
        .text(d => getDistrictLabel(d.district));
}

//load all data
Promise.all([loadApartmentData(), loadDogSizeData()])
    .then(([apartmentData, dogSizeDataLoaded]) => {
        livingSpaceMap = apartmentData;
        dogSizeData = dogSizeDataLoaded;

        setTimeout(() => {
            if (dogData && dogData != null &&
                dogSizeData && dogSizeData != null &&
                publicSpaceMap && publicSpaceMap != null) {
                drawChart(dogData);
            } else {
                d3.select("#activity-chart-svg").html("<text>Error: data not loaded</text>");
            }
        }, 500);
    })
    .catch(error => {
        console.error("Error loading data:", error);
        d3.select("#apartment-chart-title").text("Error loading data");
    });