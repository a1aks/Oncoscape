(function() {
    'use strict';

    angular
        .module('oncoscape')
        .directive('osHistory', history);

    /** @ngInject */
    function history() {

        var directive = {
            restrict: 'E',
            templateUrl: 'app/components/history/history.html',
            scope: {},
            controller: HistoryController,
            controllerAs: 'vm',
            bindToController: true
        };

        return directive;

        /** @ngInject */
        function HistoryController(osApi, $state, $timeout, $scope, $stateParams) {

            // View Model
            var vm = this;
            vm.datasource = $stateParams.datasource || "DEMOdz";
            vm.colnames = [];
            vm.rows = [];
            vm.deathMinFilter = vm.deathMinValue = 1;
            vm.deathMaxFilter = vm.deathMaxValue = 99;
            vm.survivalMinFilter = vm.survivalMinValue = 0;
            vm.survivalMaxFilter = vm.survivalMaxValue = 10;
            vm.search = "";
            vm.updateFilter = function(element){

                // Override Datatables Default Search Function - More Efficent Than Using Angular Bindings
                $.fn.DataTable.ext.search = [function( settings, data, dataIndex ) {
                    var alive = parseFloat(data[3]);
                    var death = parseFloat(data[4]);
                    if (isNaN(alive) || isNaN(death)) return false;
                    return (death >= vm.deathMinFilter && 
                            death <= vm.deathMaxFilter &&
                            alive >= vm.survivalMinFilter && 
                            alive <= vm.survivalMaxFilter);

                }];
                dtTable.api().draw();
            };

            // Elements
            var dtTable;

            // Load Datasets
            osApi.setBusy(true);
            osApi.setDataset(vm.datasource).then(function(response){
                osApi.getPatientHistoryTable(vm.datasource).then(function(response){
                    vm.colnames= response.payload.colnames;
                    vm.rows = response.payload.tbl;
                    $timeout(function(){
                        dtTable = $('#datatable').dataTable({
                            "paging": false
                        });
                        $scope.$watch('vm.search', function(){
                            dtTable.api().search(vm.search).draw();
                        });
                        osApi.setBusy(false);
                    },0,false);
                });
            });
        }
    }
})();