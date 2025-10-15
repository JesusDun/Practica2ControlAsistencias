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

    // --- ¡NUEVA LÓGICA AÑADIDA PARA ELIMINAR! ---
    $(document).on("click", ".btn-eliminar-empleado", function () {
        const id = $(this).data("id");
        const nombre = $(this).data("nombre");

        // Pedir confirmación antes de borrar
        if (confirm(`¿Estás seguro de que deseas eliminar a ${nombre}?`)) {
            $.ajax({
                url: `/empleado/${id}`,
                type: 'DELETE',
                success: function(response) {
                    // No es necesario hacer nada aquí, Pusher se encargará de refrescar la tabla
                    console.log(response.message);
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON ? xhr.responseJSON.error : "Error desconocido.";
                    alert(`No se pudo eliminar al empleado. Error: ${errorMsg}`);
                }
            });
        }
    });
});

// Controlador de Asistencias
app.controller("asistenciasCtrl", function ($scope, PusherService) {

    // Función para recargar la tabla de asistencias desde el servidor
    function buscarAsistencias() {
        $.get("/tbodyAsistencias", (trsHTML) => {
            $("#tbodyAsistencias").html(trsHTML);
        });
    }

    // Suscripción a Pusher para actualizaciones en tiempo real
    const channel = PusherService.subscribe("canalAsistencias");
    channel.bind("eventoAsistencias", buscarAsistencias);

    // Cargar las asistencias al iniciar el controlador
    buscarAsistencias();

    // --- Lógica para Guardar/Actualizar Asistencia ---
    $("#frmAsistencia").submit(function (e) {
        e.preventDefault(); // Evitar el envío normal del formulario

        const id = $("#hiddenId").val();
        const fecha = $("#txtFecha").val();
        const comentarios = $("#txtComentarios").val();

        $.post("/asistencia", {
            id: id,
            fecha: fecha,
            comentarios: comentarios
        }, function (response) {
            if (response.success) {
                // Limpiar el formulario después de guardar/actualizar
                $("#frmAsistencia")[0].reset();
                $("#hiddenId").val(""); // Asegurarse de limpiar el ID oculto

                // Notificar a Pusher para actualizar la tabla en todos los clientes
                PusherService.trigger("canalAsistencias", "eventoAsistencias");
                alert("Asistencia guardada/actualizada con éxito.");
            } else {
                alert("Error al guardar/actualizar la asistencia: " + response.message);
            }
        }).fail(function () {
            alert("Error de comunicación con el servidor.");
        });
    });

    // --- Lógica para Editar Asistencia (Delegación de Eventos) ---
    // Usamos 'document' para la delegación ya que #tbodyAsistencias se actualiza.
    $(document).on("click", ".btn-editar-asistencia", function () {
        const id = $(this).data("id");
        const fecha = $(this).data("fecha");
        const comentarios = $(this).data("comentarios");

        // Rellenar el formulario con los datos de la asistencia a editar
        $("#hiddenId").val(id);
        $("#txtFecha").val(fecha);
        $("#txtComentarios").val(comentarios);

        // Opcional: Desplazar la vista al formulario si está muy abajo
        $('html, body').animate({
            scrollTop: $("#frmAsistencia").offset().top - 100 // Ajusta el -100 si es necesario
        }, 500);
    });

    // --- Lógica para Eliminar Asistencia (Delegación de Eventos) ---
    $(document).on("click", ".btn-eliminar-asistencia", function () {
        const id = $(this).data("id");

        if (confirm("¿Estás seguro de que quieres eliminar esta asistencia?")) {
            $.post("/asistencia/eliminar", { id: id }, function (response) {
                if (response.success) {
                    // Notificar a Pusher para actualizar la tabla en todos los clientes
                    PusherService.trigger("canalAsistencias", "eventoAsistencias");
                    alert("Asistencia eliminada con éxito.");
                } else {
                    alert("Error al eliminar la asistencia: " + response.message);
                }
            }).fail(function () {
                alert("Error de comunicación con el servidor.");
            });
        }
    });

});
// Controlador de Pases Asistencias
app.controller("asistenciaspasesCtrl", function ($scope, PusherService) {
    function buscarAsistenciasPases(busqueda = "") {
        const url = busqueda ? `/tbodyAsistenciasPases?busqueda=${encodeURIComponent(busqueda)}` : '/tbodyAsistenciasPases';
        $.get(url, (trsHTML) => $("#tbodyAsistenciasPases").html(trsHTML));
    }
    const channel = PusherService.subscribe("canalAsistenciasPases");
    channel.bind("eventoAsistenciasPases", () => buscarAsistenciasPases($("#txtBusqueda").val()));

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

    $(document).off("submit", "#frmBusqueda").on("submit", "#frmBusqueda", function(e) {
        e.preventDefault();
        const busqueda = $("#txtBusqueda").val();
        buscarAsistenciasPases(busqueda);
    });

    $(document).off("click", ".btn-eliminar-pase").on("click", ".btn-eliminar-pase", function() {
        const id = $(this).data("id");
        if (confirm('¿Estás seguro de que deseas eliminar este registro?')) {
            $.ajax({
                url: `/asistenciapase/${id}`,
                type: 'DELETE',
                success: function(response) {
                    console.log(response.message);
                },
                error: function(res) {
                    alert("Error al eliminar: " + (res.responseJSON?.error || "Error de servidor"));
                }
            });
        }
    });
});

// Controlador de Departamentos
app.controller("departamentosCtrl", function ($scope, PusherService) {
    console.log("departamentosCtrl activo");

    function buscarDepartamentos(filtro = "") {
        $.get("/tbodyDepartamentos", { busqueda: filtro }, (trsHTML) => {
            $("#tbodyDepartamentos").html(trsHTML);
        });
    }

    const channel = PusherService.subscribe("canalDepartamentos");
    channel.bind("eventoDepartamentos", () => buscarDepartamentos($("#txtBuscarDepartamento").val()));
    buscarDepartamentos();
    
    $(document).off("keyup", "#txtBuscarDepartamento").on("keyup", "#txtBuscarDepartamento", function() {
        const valor = $(this).val();
        buscarDepartamentos(valor);
    });

    // Guardar departamento
    $(document).off("submit", "#frmDepartamento").on("submit", "#frmDepartamento", function(e) {
        e.preventDefault();
        $.post("/departamento", $(this).serialize()).done(() => {
            this.reset();
            $("#idDepartamento").val("");
            buscarDepartamentos($("#txtBuscarDepartamento").val());
        });
    });

    $(document).off("click", ".btnEditar").on("click", ".btnEditar", function () {
        $("#idDepartamento").val($(this).data("id"));
        $("#txtNombreDepartamento").val($(this).data("nombre"));
        $("#txtEdificio").val($(this).data("edificio"));
        $("#txtDescripcion").val($(this).data("descripcion"));
        $("html, body").animate({ scrollTop: 0 }, "fast");
    });
    
    $(document).off("click", ".btnEliminar").on("click", ".btnEliminar", function () {
        const id = $(this).data("id");
        if (confirm("¿Deseas eliminar este departamento?")) {
            $.ajax({
                url: `/departamento/${id}`,
                type: "DELETE",
                success: function () {
                    buscarDepartamentos();
                },
                error: function (xhr) {
                    alert("Error al eliminar: " + xhr.responseText);
                }
            });
        }
    });
});

