const width = 800;
const height = 600;

//global variables for filter (all vs pure breeds)
let geoDataGlobal = null;
let dogDataGlobal = null;
let dogsByDistrictGlobal = null;
let currentDistrict = null;
let currentFilter = 'all';

const svg = d3.select("#vienna-map");

const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("display", "none");

Promise.all([
    d3.json("data/BEZIRKSGRENZEOGD_wgs84.geojson"),
    d3.dsv(";", "data/hunde-wien.csv")
]).then(([geoData, dogData]) => {

    //geoMercator creates map-projection, converts längen-/breitengrad to x-y-coordinates
    const projection = d3.geoMercator()
        .center([16.37, 48.21]) // ~ center of vienna
        .scale(90000) // to display accordingly
        .translate([width / 2, height / 2]); // center shall be in the middle

    //converts geometry in svg-paths for later selection
    const path = d3.geoPath(projection);

    // reverse winding so SVG fills district interiors
    // reverse is fixing issue with only drawing one district (last one, rest fills whole graph)
    const features = geoData.features.map(d => ({
        ...d,
        geometry: {
            type: "Polygon",
            coordinates: [d.geometry.coordinates[0].slice().reverse()]
        }
    }));

    geoDataGlobal = geoData;
    dogDataGlobal = dogData;

    // group dog data per district, + casts DISTRICT_CODE to number (1, 2, ...) for easier handling
    const dogsByDistrict = d3.group(dogData, r => +r.DISTRICT_CODE);
    dogsByDistrictGlobal = dogsByDistrict;

    // filter dogs for selected radio-button (all vs. pure breeds)
    function filterDogData(dogData, filterType) {
        if (filterType === "all") {
            currentFilter = 'all';
            return dogData;
        } else {
            return dogData.filter(row => {
                const breed = row["Dog Breed"] || "";
                currentFilter = 'pure'
                //only dogs that do not contain "/" or "Mischling" or "Unbekannt"
                return !breed.includes("/") &&
                    breed !== "Unbekannt" &&
                    !breed.includes("Mischling");
            });
        }
    }

    // Update filter function
    function updateFilter(filterValue, dogData) {
        const filtered = filterDogData(dogData, filterValue);
        return d3.group(filtered, r => +r.DISTRICT_CODE);
    }

    function drawMap(dogsPerDistrictParam) {
        // Clear existing map elements
        svg.selectAll("path").remove();
        svg.selectAll("text").remove();

        // uses svg-paths to draw districts, add tooltips and make each dristrict clickable
        svg.selectAll("path")
            .data(features)
            .join("path")
            .attr("class", "district")
            .attr("d", d => path(d))
            .attr("fill", "#f0a500")
            .attr("stroke", "white")
            .attr("stroke-width", 1)
            .on("mousemove", function (event, d) {
                tooltip
                    .style("display", "block")
                    .style("left", (event.pageX + 12) + "px")
                    .style("top", (event.pageY - 28) + "px")
                    .text(d.properties.NAMEK);
            })
            .on("mouseout", function () {
                tooltip.style("display", "none");
            })
            .on("click", function (event, d) {
                svg.selectAll(".district").attr("fill", "#f0a500");
                d3.select(this).attr("fill", "#e05c7a");
                currentDistrict = d.properties;
                drawBreedChart(d.properties, dogsPerDistrictParam);
            });
        
        // if there's a current district, keep it pink, even when pure/all breed selection changes
        if (currentDistrict) {
            svg.selectAll(".district")
                .filter(function(d) {
                    return d.properties.BEZNR === currentDistrict.BEZNR;
                })
                .attr("fill", "#e05c7a");
        }

        //draws district number (1-23) into middle of districts
        svg.selectAll("text")
            .data(features)
            .join("text")
            .attr("x", d => path.centroid(d)[0])
            .attr("y", d => path.centroid(d)[1])
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .attr("font-size", "11px")
            .attr("font-weight", "bold")
            .attr("fill", "black")
            .attr("pointer-events", "none")
            .text(d => d.properties.BEZNR);
    }

    //draws breedChart for selected district (props from district as input parameter)
    function drawBreedChart(props, dogsByDistrictParam) {
        const csvCode = (props.BEZNR + 900) * 100;
        const rows = dogsByDistrictParam.get(csvCode) ?? [];

        //rollup: group data per breed name, sum up count (if there are multiple entries per breed)
        //make array out of map
        //sort - biggest value at the top, slice - only 10 breeds
        const top10 = Array.from(
            d3.rollup(rows, v => d3.sum(v, r => +r.Anzahl), r => r["Dog Breed"]),
            ([breed, count]) => ({ breed, count })
        )
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        const margin = { top: 20, right: 30, bottom: 40, left: 220 };
        const cWidth = width * 0.45;
        const cHeight = top10.length * 30;

        d3.select("#breed-chart-title")
            .text(`Top 10 dog breeds in ${props.NAMEK_NUM} (${currentFilter})`);

        d3.select("#breed-chart").style("display", "block");

        const chartSvg = d3.select("#breed-chart-svg")
            .attr("width", cWidth + margin.left + margin.right)
            .attr("height", cHeight + margin.top + margin.bottom);

        chartSvg.selectAll("*").remove();

        const g = chartSvg.append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        const x = d3.scaleLinear()
            .domain([0, d3.max(top10, d => d.count)])
            .range([0, cWidth]);

        const y = d3.scaleBand()
            .domain(top10.map(d => d.breed))
            .range([0, cHeight])
            .padding(0.25);

        g.append("g")
            .call(d3.axisLeft(y).tickSize(0))
            .call(g => g.select(".domain").remove())
            .selectAll("text")
            .attr("font-size", "12px");

        g.append("g")
            .attr("transform", `translate(0,${cHeight})`)
            .call(d3.axisBottom(x).ticks(5))
            .append("text")
            .attr("x", cWidth)
            .attr("y", 35)
            .attr("fill", "black")
            .attr("text-anchor", "end")
            .text("# dogs");

        g.selectAll(".bar")
            .data(top10)
            .join("rect")
            .attr("class", "bar")
            .attr("x", 0)
            .attr("y", d => y(d.breed))
            .attr("width", d => x(d.count))
            .attr("height", y.bandwidth())
            .attr("fill", "#e05c7a");

        g.selectAll(".bar-label")
            .data(top10)
            .join("text")
            .attr("class", "bar-label")
            .attr("x", d => x(d.count) + 5)
            .attr("y", d => y(d.breed) + y.bandwidth() / 2)
            .attr("dy", "0.35em")
            .attr("font-size", "11px")
            .attr("fill", "#333")
            .text(d => d.count);
    }

    drawMap(dogsByDistrict);

    //event handler if filter is changed (pure or all)
    d3.selectAll('input[name="breed-filter"]').on("change", function() {
        const filterValue = this.value;
        const newDogsByDistrict = updateFilter(filterValue, dogData);
        drawMap(newDogsByDistrict);
        
        if (currentDistrict) {
            drawBreedChart(currentDistrict, newDogsByDistrict);
        }
    });

})
    .catch(error => {
        console.error(error);
    });
