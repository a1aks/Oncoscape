(function() {
    'use strict';

    angular
        .module('oncoscape')
        .directive('osPca', explore);

    /** @ngInject */
    function explore() {

        var directive = {
            restrict: 'E',
            templateUrl: 'app/components/pca/pca.html',
            controller: PcaController,
            controllerAs: 'vm',
            bindToController: true
        };

        return directive;

        /** @ngInject */
        function PcaController($q, osApi, $state, $stateParams, $timeout, $scope, d3, moment, $window,$http,  _, ML) {

            // Loading ...
            osApi.setBusy(true);

            // Elements
            var d3Chart = d3.select("#pca-chart").append("svg");
            var d3Points = d3Chart.append("g");
            var d3xAxis = d3Chart.append("g");
            var d3yAxis = d3Chart.append("g");
            var circles;

            // Add Labels
            d3xAxis.append("text")
                .attr("x", 50)
                .attr("y", 15)
                .text("PC1");


            d3yAxis.append("text")
                .attr("y", 55)
                .attr("x", 25)
                .text("PC2");

            // Properties
            //var clusterCollection = osApi.getDataSource().disease + "_cluster";
            var scaleX, scaleY, axisX, axisY;
            var data, minMax;
            var width, height;
            var colors = {
                data: [],
                dataset: osApi.getDataSource().disease,
                name: "None",
                type: "color"
            };
            var acceptableDatatypes = [];

            // View Model Update
            var vm = (function(vm, osApi) {
                vm.loadings = [];
                vm.pc1 = vm.pc2 = [];
                vm.datasource = osApi.getDataSource();
               
                vm.sources = [];
                vm.source = null;
                
                vm.search = "";
                vm.selectColor = function(e) {
                    var ids = e.values;
                    var allIds = [];
                    d3.selectAll("circle.pca-node").each(function(d) {
                        if (ids.indexOf(d.id) != -1) {
                            d3.select(this).classed("pca-node-selected", true);
                            allIds.push(d.id);
                        } else {
                            if (d3.select(this).classed("pca-node-selected")) allIds.push(d.id);
                        }
                    });
                    osApi.setCohort(allIds, "PCA", osApi.SAMPLE);
                };
                vm.deselectColor = function(e) {
                    var ids = e.values;
                    var allIds = [];
                    d3.selectAll("circle.pca-node").each(function(d) {
                        if (ids.indexOf(d.id) != -1) {
                            d3.select(this).classed("pca-node-selected", false);
                        } else {
                            if (d3.select(this).classed("pca-node-selected")) allIds.push(d.id);
                        }
                    });
                    osApi.setCohort(allIds, "PCA", osApi.SAMPLE);
                };
                
                return vm;
            })(this, osApi);

            // Gene Service Integration
              osApi.onGenesetChange.add(function(geneset) {
                osApi.setBusy(true);
                vm.geneSet =  geneset
              });

            // Move To Service 
            function PCAquery(disease, genes, samples, molecular_collection, n_components) {
                var data = { disease: disease, genes: genes, samples: samples, molecular_collection: molecular_collection, n_components: n_components };
                return $http({
                    method: 'POST',
                 //   url: "https://dev.oncoscape.sttrcancer.io/cpu/pca",
                    url: "http://localhost:8000/pca",
                    data: data,
                    
                    
                });
            }

            function processPCA(d, geneIds, samples){

                console.log("PCA: processing results " + Date())
                
                // Process PCA Variance
                vm.pc1 = [
                    { name: 'PC1', value: (d.metadata.variance[0] * 100).toFixed(2) },
                    { name: '', value: 100 - (d.metadata.variance[0]*100) }
                ];
                vm.pc2 = [
                    { name: 'PC2', value: (d.metadata.variance[1] *100).toFixed(2) },
                    { name: '', value: 100 - (d.metadata.variance[1] *100) }
                ];


                // Process Scores
                data = d.scores.map(function(v,i) {
                    v.id = samples[i];
                    return v;
                });

                minMax = data.reduce(function(p, c) {
                    p.xMin = Math.min(p.xMin, c[0]);
                    p.xMax = Math.max(p.xMax, c[0]);
                    p.yMin = Math.min(p.yMin, c[1]);
                    p.yMax = Math.max(p.yMax, c[1]);
                    return p;
                }, {
                    xMin: Infinity,
                    yMin: Infinity,
                    xMax: -Infinity,
                    yMax: -Infinity
                });

            }

            // Setup Watches
            
            $scope.$watch('vm.source', function() {
                
                if (vm.source === null) return;
                
                vm.pcaTypes = _.uniq(_.pluck(vm.molecularTables.filter(function(d) {return d.source == vm.source}), "type"))
                vm.pcaTypes = _.intersection(vm.pcaTypes, acceptableDatatypes)

                if (angular.isUndefined(vm.pcaType)) {
                    vm.pcaType = vm.pcaTypes[0];
                } else {
                    var newSource = vm.pcaTypes.filter(function(v) { return (v === vm.pcaType); });
                    vm.pcaType = (newSource.length === 1) ? newSource[0] : vm.pcaTypes[0];
                }
            });
            $scope.$watch('vm.pcaType', function() {
                
                if (vm.source === null) return;

                vm.geneSet = osApi.getGeneset()                    
                var molecular_matches = vm.molecularTables.filter(function(d){return d.type == vm.pcaType & d.source == vm.source})
                
                if(molecular_matches.length ==1){
                    var molecular_collection = molecular_matches[0].collection
                
                    var runType = "python";
                    if(runType == "simulate"){
                        var numGenes = [100,200,500,1000, 5000, 10000,15000, 20000, 25000]; var numSamples = [100,200,500];
                        for(var i=0;i<numSamples.length;i++){
                            for(var j=0;j<numGenes.length;j++){
                                console.log("Genes: "+ numGenes[j] + " Samples: "+ numSamples[i])
                                runPCAsimulation(numGenes[j], numSamples[i]);
                            }
                        }
                        
                    }else if(runType == "JS") {
                        osApi.query(molecular_collection
                        ).then(function(response){
                            debugger;
                            vm.molecular = response.data

                            if (angular.isUndefined(vm.geneSet)) return;
                            runPCA(vm.geneSet.geneIds);
                        });
                    }else if(runType == "python") {
                        if (angular.isUndefined(vm.geneSet)) return;

                        var samples = osApi.getCohort().sampleIds;
                        if (samples.length === 0) samples = Object.keys(osApi.getData().sampleMap);

                        var geneSetIds = vm.geneSet.geneIds
                        if(geneSetIds.length == 0) 
                            osApi.query(molecular_collection, {"$fields":["id"]}).then(function(response){
                                debugger;
                                geneSetIds = _.pluck(response.data, "id")
                            })
                            

                        PCAquery(vm.datasource.disease, geneSetIds, samples, molecular_collection, 3).then(function(PCAresponse) {
                            
                            var d = PCAresponse.data;
                            if(d.reason !== undefined){
                                //vm.globalGeneSets[vm.globalGeneSets.findIndex(function(gs){return gs.uuid == geneset.uuid})].reason = d.reason;
                                console.log(vm.geneSet.name +": " + d.reason)
                                //console.log(geneset)
                                osApi.setBusy(false)
                                return;
                            }
                            
                            //TO DO:: ### Update result names from oncoscape_wrapper so values -> d, and make variance values into percentages (ie *100)
                            d.loadings = d.loadings.map(function(result){ return {id: result.id, d:result.value}});
                            d.scores = d.scores.map(function(result){ return {id: result.id, d:result.value}});
                            d.metadata.variance = d.metadata.variance.map(function(result) {return 100* result})
                            processPCA(d);
                            draw();
                        });
                    }
                }

            });
             $scope.$watch('vm.geneSet', function(geneset) {
             
                if (angular.isUndefined(geneset)) return;
                if (angular.isUndefined(vm.molecular)) return;
                debugger;
                console.log("PCA: started")
                runPCA(geneset.geneIds);

             });


             var runPCAsimulation = function(numGenes, numSamples) {

                var options = {isCovarianceMatrix: false, center : true, scale: false};
                // create 2d array of samples x features (genes)
                var molecular = Array.apply(null, {length: numSamples}).map(function(s){ return Array.apply(null, {length: numGenes}).map(Function.call, Math.random)});
                
                var then = Date.now();
                //console.log("PCA: Running " + Date())
                var d = new ML.Stat.PCA(molecular, options)
                var now = Date.now()
                //console.log("PCA: transforming scores " + Date())
                console.log("Genes: "+ numGenes + " Samples: "+numSamples+ "Diff: " + (now-then)/1000)

             }

             var runPCA = function(geneIds) {

                var options = {isCovarianceMatrix: false, center : true, scale: false};

                // Subset samples to those available in the collection
                var samples = osApi.getCohort().sampleIds;
                if (samples.length === 0) samples = Object.keys(osApi.getData().sampleMap);
                samples = samples.filter(function(s){ return _.has(vm.molecular[0].data,s) })

                //subset geneIds to be only those returned from query
                geneIds = _.intersection( _.pluck(vm.molecular,"id"), geneIds)
                
                

                // create 2d array of samples x features (genes)
                var molecular = samples.map(function(s){ return vm.molecular.map(function(g){ return g.data[s]})  })
                //var molecular = response.data.map(function(g){ return samples.map(function(s){ return g.data[s]})  })
                
                console.log("PCA: Running " + Date())
                var d = new ML.Stat.PCA(molecular, options)
                console.log("PCA: transforming scores " + Date())
                d.metadata = {}
                d.metadata.variance = d.getExplainedVariance()
                d.loadings = d.getLoadings() // [[PC1 loadings (for coefficients for each gene)], [PC2 loadings], [...#PC = # samples]]
                
                d.scores = d.predict(molecular)
                // var z = molecular.map(function(m){return jStat.subtract(m, d.means)}) //, scale = Array(d.means.length).fill(1)
                // d.scores = z.map(function(m){ return d.getLoadings().map(function(ev) { return jStat.dot(m, ev)})});

                processPCA(d, geneIds, samples);
                draw();
                
            }

            var updatePatientCounts = function() {

                angular.element(".legend-count").text("");
                var selectedPatients = osApi.getCohort().sampleIds;

                if (selectedPatients.length === 0) 
                   selectedPatients = data.map(function(d){
                    return d.id})

                var counts = data.filter(function(d){return selectedPatients.indexOf(d.id) !== -1}).reduce(function(p, c) {
                    var color = c.color;
                    if (!p.hasOwnProperty(color)) p[color] = 0;
                    p[color] += 1;
                    return p;
                }, {});

                Object.keys(counts).forEach(function(key) {
                    angular.element("#legend-" + key.substr(1)).text(" (" + this[key] + ")");
                }, counts);

            };

            // Utility Functions
            function setSelected() {
                var selectedIds = cohort.sampleIds;
                d3Points.selectAll("circle").classed("pca-node-selected", function() {
                    return (selectedIds.indexOf(this.__data__.id) >= 0);
                });

            }

            function setColors() {

                // Set Legend
                vm.legendCaption = colors.name;
                vm.legendNodes = colors.data;

                // If No Color Specified
                if (colors.name == "None") {
                    vm.legendCaption = "";
                    data.forEach(function(v) {
                        v.color = '#0096d5';
                    });

                    // Color Based On V
                } else {
                    var degMap = colors.data.reduce(function(p, c) {
                        for (var i = 0; i < c.values.length; i++) {
                            p[c.values[i]] = c.color;
                        }
                        return p;
                    }, {});
                    data = data.map(function(v) {
                        v.color = (angular.isDefined(this[v.id])) ? this[v.id] : "#DDD";
                        return v;
                    }, degMap);
                }
                $timeout(updatePatientCounts);
                 
            }

            var lasso_start = function() {

                lasso.items()
                    .attr("r", 3.5) // reset size
                    .classed("not_possible", true)
                    .classed("selected", false);
            };

            var lasso_draw = function() {


                // Style the possible dots
                lasso.possibleItems()
                    .classed("not_possible", false)
                    .classed("possible", true);

                // Style the not possible dot
                lasso.notPossibleItems()
                    .classed("not_possible", true)
                    .classed("possible", false);
            };

            var lasso_end = function() {

                // Reset the color of all dots
                lasso.items()
                    .classed("not_possible", false)
                    .classed("possible", false);

                var ids = lasso.selectedItems().data().map(function(d) {
                    return d.id;
                });
                osApi.setCohort(ids, "PCA", osApi.SAMPLE);

            };

            var lasso = d3.lasso()
                .closePathSelect(true)
                .closePathDistance(100)
                .targetArea(d3Chart)
                .on("start", lasso_start)
                .on("draw", lasso_draw)
                .on("end", lasso_end);

            function draw() {

                // Colorize
                setColors();
                

                // Size
                var layout = osApi.getLayout();
                width = $window.innerWidth - layout.left - layout.right;
                height = $window.innerHeight - 120; //10
                angular.element("#pca-chart").css({
                    "width": width + "px",
                    "padding-left": layout.left + "px"
                });

                d3Chart.attr("width", width).attr("height", height);
                d3Points.attr("width", width).attr("height", height);

                // Scale
                scaleX = d3.scaleLinear().domain([minMax.xMin, minMax.xMax]).range([50, width - 50]).nice();
                scaleY = d3.scaleLinear().domain([minMax.yMin, minMax.yMax]).range([50, height - 50]).nice();

                // Draw
                circles = d3Points.selectAll("circle").data(data);
                circles.enter().append("circle")
                    .attr("class", "pca-node")
                    .attr("cx", function(d) {
                        return scaleX(d[0]);
                    })
                    .attr("cy", function(d) {
                        return scaleY(d[1]);
                    })
                    .attr("r", 3)
                    .style("fill", function(d) {
                        return d.color;
                    });

                circles.exit()
                    .transition()
                    .duration(200)
                    .delay(function(d, i) {
                        return i / 300 * 100;
                    })
                    .style("fill-opacity", "0")
                    .remove();
                circles
                    .style("fill", function(d) {
                        return d.color;
                    })
                    .transition()
                    .duration(750)
                    .delay(function(d, i) {
                        return i / 300 * 100;
                    })
                    .attr("r", 3)
                    .attr("cx", function(d) {
                        return scaleX(d[0]);
                    })
                    .attr("cy", function(d) {
                        return scaleY(d[1]);
                    })
                    .style("fill", function(d) {
                        return d.color;
                    })
                    .style("fill-opacity", 0.8);

                // Axis
                axisX = d3.axisTop().scale(scaleX).ticks(3);
                axisY = d3.axisLeft().scale(scaleY).ticks(3);

                d3xAxis
                    .attr("class", "axis")
                    .attr("transform", "translate(0, " + height * 0.5 + ")")
                    .call(axisX);


                d3yAxis
                    .attr("class", "axis")
                    .attr("transform", "translate(" + width * 0.5 + ", 0)")
                    .call(axisY);


                lasso.items(d3Points.selectAll("circle"));
                d3Chart.call(lasso);

                onCohortChange(osApi.getCohort());
                //onGenesetChange(osApi.getGeneset());
                osApi.setBusy(false);


            }


            // App Event :: Resize
            osApi.onResize.add(draw);

            // App Event :: Color change
            var onPatientColorChange = function(value) {
                colors = value;
                vm.showPanelColor = false;
                draw();
            };
            osApi.onPatientColorChange.add(onPatientColorChange);

            // App Event :: Cohort Change
            var cohort = osApi.getCohorts();
            var onCohortChange = function(c) {
                cohort = c;
                setSelected();
            };
            osApi.onCohortChange.add(onCohortChange);
            osApi.onCohortChange.add(updatePatientCounts)

            osApi.query("lookup_dataTypes", {
                class: {$in : ["expr", "cnv", "mut01", "meth_thd", "meth", "cnv_thd"]},
                schema: "hugo_sample"
            }).then(function(response) {
                acceptableDatatypes = _.uniq(_.pluck(response.data, "dataType"))
            });

            osApi.query("lookup_oncoscape_datasources", {
                disease: vm.datasource.disease
            }).then(function(response){
                vm.molecularTables = response.data[0].molecular
            
                vm.sources = _.uniq(_.pluck(vm.molecularTables, "source"))
                vm.source = vm.sources[0]
            });

            
           
        

            // Destroy
            $scope.$on('$destroy', function() {
                osApi.onResize.remove(draw);
                osApi.onPatientColorChange.remove(onPatientColorChange);
                osApi.onCohortChange.remove(onCohortChange);
            });
        }
    }
})();