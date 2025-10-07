// Función para marcar la opción activa en el menú
function activeMenuOption(href) {
    $(".app-menu .nav-link").removeClass("active").removeAttr('aria-current');
    $(`.app-menu .nav-link[href="${href}"]`).addClass("active").attr("aria-current", "page");
}

const app = angular.module("angularjsApp", ["ngRoute"]);

// Configuración de las rutas de la aplicación
app.config(function ($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix("");

    $routeProvider
    .when("/", {
        redirectTo: "/empleados"
    })
    .when("/empleados", {
        templateUrl: "/empleados",
        controller: "empleadosCtrl"
    })
    .when("/asistencias", {
        templateUrl: "/asistencias",
        controller: "asistenciasCtrl"
    })
    .when("/asistenciaspases", {
        templateUrl: "/asistenciaspases",
        controller: "asistenciaspasesCtrl"
    })
    .when("/departamentos", {
        templateUrl: "/departamentos",
        controller: "departamentosCtrl"
    })
    .otherwise({
        redirectTo: "/empleados"
    });
});

// Servicio para compartir una única instancia de Pusher
app.factory('PusherService', function() {
    Pusher.logToConsole = true;
    const pusher = new Pusher("686124f7505c58418f23", {
        cluster: "us2"
    });
    return pusher;
});

// Bloque de ejecución principal para animaciones y reloj
app.run(["$rootScope", "$location", "$timeout", function($rootScope, $location, $timeout) {
    function actualizarFechaHora() {
        $rootScope.angularjsHora = luxon.DateTime.now().setLocale("es").toFormat("hh:mm:ss a");
        $timeout(actualizarFechaHora, 1000);
    }
    actualizarFechaHora();

    $rootScope.$on("$routeChangeSuccess", function (event, current, previous) {
        if (!current || !current.$$route) return;

        const path = current.$$route.originalPath;
        activeMenuOption(`#${path}`);
    });
}]);

// =========================================================================
// CONTROLADORES
// =========================================================================

app.controller("empleadosCtrl", function ($scope, PusherService) {
    function buscarEmpleados() {
        $.get("/tbodyEmpleados", (trsHTML) => $("#tbodyEmpleados").html(trsHTML));
    }
    const channel = PusherService.subscribe("canalEmpleados");
    channel.bind("eventoEmpleados", buscarEmpleados);
    buscarEmpleados();

    $(document).off("submit", "#frmEmpleado").on("submit", "#frmEmpleado", function (e) {
        e.preventDefault();
        $.post("/empleado", $(this).serialize())
            .done(() => {
                this.reset();
                $("#idEmpleado").val("");
            })
            .fail(res => alert("Error al guardar: " + (res.responseJSON?.error || "Error")));
    });

    $(document).on("click", ".btn-editar-empleado", function () {
        $("#idEmpleado").val($(this).data("id"));
        $("#txtNombreEmpleado").val($(this).data("nombre"));
        $("#txtNumero").val($(this).data("numero"));
        $("#txtFechaIngreso").val($(this).data("fecha"));
        $("#selIdDepartamento").val($(this).data("iddepartamento"));
    });
});

app.controller("asistenciasCtrl", function ($scope, PusherService) {
    function buscarAsistencias() {
        $.get("/tbodyAsistencias", (trsHTML) => $("#tbodyAsistencias").html(trsHTML));
    }
    const channel = PusherService.subscribe("canalAsistencias");
    channel.bind("eventoAsistencias", buscarAsistencias);
    buscarAsistencias();
});

app.controller("asistenciaspasesCtrl", function ($scope, PusherService) {
    function buscarAsistenciasPases() {
        $.get("/tbodyAsistenciasPases", (trsHTML) => $("#tbodyAsistenciasPases").html(trsHTML));
    }
    const channel = PusherService.subscribe("canalAsistenciasPases");
    channel.bind("eventoAsistenciasPases", buscarAsistenciasPases);
    buscarAsistenciasPases();

    $(document).off("submit", "#frmAsistenciasPase").on("submit", "#frmAsistenciasPase", function(e) {
        e.preventDefault();
        $.post("/asistenciapase", $(this).serialize())
            .done(() => {
                this.reset();
                $("#idAsistenciaPase").val("");
            })
            .fail(res => alert("Error al guardar: " + (res.responseJSON?.error || "Error")));
    });

    $(document).on("click", ".btn-editar-pase", function () {
        $("#idAsistenciaPase").val($(this).data("id"));
        $("#selIdEmpleado").val($(this).data("idempleado"));
        $("#selIdAsistencia").val($(this).data("idasistencia"));
        $("#selEstado").val($(this).data("estado"));
    });
});

app.controller("departamentosCtrl", function ($scope, PusherService) {
    function buscarDepartamentos() {
        $.get("/tbodyDepartamentos", (trsHTML) => $("#tbodyDepartamentos").html(trsHTML));
    }
    const channel = PusherService.subscribe("canalDepartamentos");
    channel.bind("eventoDepartamentos", buscarDepartamentos);
    buscarDepartamentos();

    $(document).off("submit", "#frmDepartamento").on("submit", "#frmDepartamento", function(e) {
        e.preventDefault();
        $.post("/departamento", $(this).serialize()).done(() => {
            this.reset();
            $("#idDepartamento").val("");
        });
    });
});
