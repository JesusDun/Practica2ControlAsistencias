function activeMenuOption(href) {
    $(".app-menu .nav-link")
    .removeClass("active")
    .removeAttr('aria-current')

    $(`[href="${(href ? href : "#/")}"]`)
    .addClass("active")
    .attr("aria-current", "page")
}

const app = angular.module("angularjsApp", ["ngRoute"])
app.config(function ($routeProvider, $locationProvider) {
    $locationProvider.hashPrefix("")

    $routeProvider
    .when("/", {
        templateUrl: "/login",
        controller: "loginCtrl"
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
        redirectTo: "/"
    })
})

app.run(["$rootScope", "$location", "$timeout", function($rootScope, $location, $timeout) {
    // ... Código del profesor para fecha/hora y animaciones (sin cambios) ...
    function actualizarFechaHora() {
        lxFechaHora = DateTime
        .now()
        .setLocale("es")

        $rootScope.angularjsHora = lxFechaHora.toFormat("hh:mm:ss a")
        $timeout(actualizarFechaHora, 1000)
    }

    $rootScope.slide = ""

    actualizarFechaHora()

    $rootScope.$on("$routeChangeSuccess", function (event, current, previous) {
        $("html").css("overflow-x", "hidden")
        
        const path = current.$$route.originalPath

        if (path.indexOf("splash") == -1) {
            const active = $(".app-menu .nav-link.active").parent().index()
            const click  = $(`[href^="#${path}"]`).parent().index()

            if (active != click) {
                $rootScope.slide  = "animate__animated animate__faster animate__slideIn"
                $rootScope.slide += ((active > click) ? "Left" : "Right")
            }

            $timeout(function () {
                $("html").css("overflow-x", "auto")

                $rootScope.slide = ""
            }, 1000)

            activeMenuOption(`#${path}`)
        }
    })
}])

// Controlador para Login
app.controller("loginCtrl", function ($scope, $http, $window) {
    $("#frmInicioSesion").submit(function (event) {
        event.preventDefault();
        
        $.post("/iniciarSesion", $(this).serialize())
            .done(function (respuesta) {
                if (respuesta.error) {
                    alert(respuesta.error);
                }
                // Si la respuesta es exitosa (login correcto)
                else if (Array.isArray(respuesta) && respuesta.length > 0) {
                    alert("Iniciaste Sesión Correctamente");
                    $window.location.href = '/#/empleados'; // Redirección
                }
            })
            .fail(function (xhr, status, error) {
                try {
                    const responseData = JSON.parse(xhr.responseText);
                    alert(responseData.error || "Error desconocido en el servidor.");
                } catch (e) {
                    alert("Hubo un problema con el servidor. Inténtalo de nuevo.");
                }
            });
    });
});

// =========================================================================
// Controlador para Empleados 
app.controller("empleadosCtrl", function ($scope, $http) {
    function buscarEmpleados() {
        $.get("/tbodyEmpleados", function (trsHTML) {
            $("#tbodyEmpleados").html(trsHTML)
        })
    }

    // --- Lógica de Pusher para tiempo real ---
    Pusher.logToConsole = true;
    var pusher = new Pusher("686124f7505c58418f23", { // Tu KEY
      cluster: "us2"
    });
    var channel = pusher.subscribe("canalEmpleados");
    channel.bind("eventoEmpleados", function(data) {
        console.log("Evento Pusher recibido para empleados, actualizando tabla...");
        buscarEmpleados();
    });

    // Carga inicial de datos
    buscarEmpleados();

    // --- Lógica de Formulario (con corrección de doble envío) ---
    $(document).off("submit", "#frmEmpleado").on("submit", "#frmEmpleado", function (event) {
        event.preventDefault();
        
        $.post("/empleado", $(this).serialize())
            .done(function() {
                // Pusher se encargará de actualizar la tabla, solo limpiamos el formulario.
                $("#frmEmpleado")[0].reset();
                $("#idEmpleado").val(""); 
            })
            .fail(function(response) {
                alert("Error al guardar: " + (response.responseJSON ? response.responseJSON.error : "Error desconocido"));
            });
    });

    // Evento para el botón "Editar" (sin cambios)
    $(document).on("click", ".btn-editar-empleado", function () {
        const id = $(this).data("id");
        const nombre = $(this).data("nombre");
        const numero = $(this).data("numero");
        const fecha = $(this).data("fecha");
        const idDepartamento = $(this).data("iddepartamento");

        $("#idEmpleado").val(id);
        $("#txtNombreEmpleado").val(nombre);
        $("#txtNumero").val(numero);
        $("#txtFechaIngreso").val(fecha);
        $("#selIdDepartamento").val(idDepartamento);
    });
});

// Controlador para Asistencias (Dirigida por Eventos)
app.controller("asistenciasCtrl", function ($scope, $http) {
    function buscarAsistencias() {
        $.get("/tbodyAsistencias", function (trsHTML) {
            $("#tbodyAsistencias").html(trsHTML);
        });
    }
    buscarAsistencias();
    
    // Configuración de Pusher
    Pusher.logToConsole = true;
    var pusher = new Pusher("686124f7505c58418f23", { // Tu KEY
      cluster: "us2"
    });
    var channel = pusher.subscribe("canalAsistencias");
    channel.bind("eventoAsistencias", function(data) {
        buscarAsistencias();
    });

    // Botón de Editar
    $(document).on("click", ".btn-editar-asistencia", function () {
        const id = $(this).data("id");
        const fecha = $(this).data("fecha");
        const comentarios = $(this).data("comentarios");

        $("#txtFecha").val(fecha);
        $("#txtComentarios").val(comentarios);
        
        if ($("#hiddenId").length === 0) {
            $("#frmAsistencia").append(`<input type="hidden" id="hiddenId" name="idAsistencia">`);
        }
        $("#hiddenId").val(id);
    });

    $(document).off("submit", "#frmAsistencia").on("submit", "#frmAsistencia", function (event) {
        event.preventDefault();
        const id = $("#hiddenId").val();
        const url = id ? "/asistencia/editar" : "/asistencia"; // Asume que tienes una ruta para editar

        $.post(url, $(this).serialize())
            .done(function () {
                buscarAsistencias();
                $("#frmAsistencia")[0].reset();
                if ($("#hiddenId").length > 0) {
                   $("#hiddenId").remove();
                }
            })
            .fail(function () {
                alert("Hubo un error al guardar la asistencia.");
            });
    });
});

// =========================================================================
// MODIFICACIÓN: Controlador para AsistenciasPases (Corregido y con Pusher)
// =========================================================================
app.controller("asistenciaspasesCtrl", function ($scope, $http) {
    function buscarAsistenciasPases() {
        $.get("/tbodyAsistenciasPases", function (trsHTML) {
            $("#tbodyAsistenciasPases").html(trsHTML);
        });
    }

    // --- Lógica de Pusher para tiempo real ---
    Pusher.logToConsole = true;
    var pusher = new Pusher("686124f7505c58418f23", { // Tu KEY
        cluster: "us2"
    });
    var channel = pusher.subscribe("canalAsistenciasPases"); // Canal específico para pases
    channel.bind("eventoAsistenciasPases", function(data) {
        console.log("Evento Pusher recibido para pases, actualizando tabla...");
        buscarAsistenciasPases(); // Recargamos la tabla cuando hay un cambio
    });

    // Carga inicial de datos
    buscarAsistenciasPases();

    // --- Lógica de Formulario para Guardar y Editar ---
    $(document).off("submit", "#frmAsistenciasPase").on("submit", "#frmAsistenciasPase", function (event) {
        event.preventDefault();

        $.post("/asistenciapase", $(this).serialize())
            .done(function() {
                // Pusher se encarga de actualizar, solo limpiamos el formulario.
                $("#frmAsistenciasPase")[0].reset();
                $("#idAsistenciaPase").val("");
            })
            .fail(function(response) {
                alert("Error al guardar el pase: " + (response.responseJSON ? response.responseJSON.error : "Error desconocido"));
            });
    });

    // --- Evento para el botón "Editar" ---
    $(document).on("click", ".btn-editar-pase", function () {
        const id = $(this).data("id");
        const idEmpleado = $(this).data("idempleado");
        const idAsistencia = $(this).data("idasistencia"); // <-- OBTENEMOS idAsistencia
        const estado = $(this).data("estado");

        // Rellenamos el formulario con los datos del pase a editar
        $("#idAsistenciaPase").val(id);
        $("#selIdEmpleado").val(idEmpleado);
        $("#selIdAsistencia").val(idAsistencia); // <-- SELECCIONAMOS LA ASISTENCIA
        $("#selEstado").val(estado);
    });
    
    // --- Evento para el botón "Eliminar" (sin cambios, pero es bueno tenerlo aquí) ---
     $(document).on("click", ".btn-eliminar-pase", function (event) {
        const id = $(this).data("id");
        if (confirm(`¿Estás seguro de eliminar el pase #${id}?`)) {
            $.post("/asistenciapase/eliminar", { id: id })
             .fail(function(response) {
                alert("Error al eliminar el pase.");
            });
            // No es necesario llamar a buscarAsistenciasPases() aquí,
            // Pusher se encargará de actualizar la tabla.
        }
    });
});

//Controlador para departamentos.
app.controller("departamentosCtrl", function ($scope, $http) {
    function buscarDepartamentos() {
        $.get("/tbodyDepartamentos", function (trsHTML) {
            $("#tbodyDepartamentos").html(trsHTML)
        })
    }
    buscarDepartamentos()

    Pusher.logToConsole = true;
    var pusher = new Pusher("686124f7505c58418f23", { // Tu KEY
      cluster: "us2"
    });
    var channel = pusher.subscribe("canalDepartamentos");
    channel.bind("eventoDepartamentos", function(data) {
        console.log("Evento Pusher recibido para Departamentos, actualizando tabla...");
        buscarDepartamentos();
    });

    $(document).on("submit", "#frmDepartamento", function (event) {
        event.preventDefault()
        $.post("/departamento", $(this).serialize())
        .done(function () {
            buscarDepartamentos()
            $("#frmDepartamento")[0].reset()
            $("#idDepartamento").val("") // Asumiendo que tienes un campo oculto con este id
        })
    })
})

const DateTime = luxon.DateTime
let lxFechaHora

document.addEventListener("DOMContentLoaded", function (event) {
    const configFechaHora = {
        locale: "es",
        weekNumbers: true,
        minuteIncrement: 15,
        altInput: true,
        altFormat: "d/F/Y",
        dateFormat: "Y-m-d",
    }
    activeMenuOption(location.hash)
})

