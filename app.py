# python.exe -m venv .venv
# cd .venv/Scripts
# activate.bat
# py -m ensurepip --upgrade
# pip install -r requirements.txt
# pip install bcrypt

from flask import Flask, render_template, request, jsonify, make_response
import mysql.connector
from flask_cors import CORS
import pusher
import bcrypt

# --- Configuración de la base de datos ---
db_config = {
    "host": "185.232.14.52",
    "database": "u760464709_23005019_bd",
    "user": "u760464709_23005019_usr",
    "password": "]0Pxl25["
}

app = Flask(__name__)
CORS(app)
app.secret_key = "tu_llave_secreta_aqui" # Se define una sola vez

# --- CONFIGURACIÓN DE PUSHER ---
pusher_client = pusher.Pusher(
    app_id='2048531',
    key='686124f7505c58418f23',
    secret='b5add38751c68986fc11',
    cluster='us2',
    ssl=True
)

# --- Funciones de Pusher para notificar a los clientes ---
def pusherAsistencias():
    pusher_client.trigger("canalAsistencias", "eventoAsistencias", {"message": "Cambio en asistencias."})

def pusherEmpleados():
    pusher_client.trigger("canalEmpleados", "eventoEmpleados", {"message": "La lista de empleados ha cambiado."})

def pusherAsistenciasPases():
    pusher_client.trigger("canalAsistenciasPases", "eventoAsistenciasPases", {"message": "La lista de pases de asistencia ha cambiado."})
    
def pusherDepartamentos():
    pusher_client.trigger("canalDepartamentos", "eventoDepartamentos", {"message": "La lista de empleados ha cambiado."})

# =========================================================================
# RUTAS BASE Y AUTENTICACIÓN
# =========================================================================

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/app")
def app2():
    return render_template("login.html")

@app.route("/iniciarSesion", methods=["POST"])
def iniciarSesion():
    con = None
    cursor = None
    try:
        usuario_ingresado = request.form.get("txtUsuario")
        contrasena_ingresada = request.form.get("txtContrasena")

        if not usuario_ingresado or not contrasena_ingresada:
            return make_response(jsonify({"error": "Usuario y/o contraseña faltantes."}), 400)

        con = mysql.connector.connect(**db_config)
        cursor = con.cursor(dictionary=True)
        
        sql = "SELECT idUsuario, password FROM usuarios WHERE username = %s"
        cursor.execute(sql, (usuario_ingresado,))
        registro_usuario = cursor.fetchone()

        usuario_encontrado = None
        
        if registro_usuario and registro_usuario['password'] == contrasena_ingresada:
            usuario_encontrado = [{"Id_Usuario": registro_usuario['idUsuario']}]
        
        if usuario_encontrado:
            return make_response(jsonify(usuario_encontrado), 200)
        else:
            return make_response(jsonify({"error": "Usuario y/o Contraseña Incorrecto(s)"}), 401)

    except mysql.connector.Error as err:
        return make_response(jsonify({"error": f"Error de base de datos: {err}"}), 500)
    except Exception as e:
        return make_response(jsonify({"error": f"Hubo un error en el servidor: {e}"}), 500)
    finally:
        if cursor:
            cursor.close()
        if con and con.is_connected():
            con.close()

# =========================================================================
# MÓDULO EMPLEADOS
# =========================================================================

@app.route("/empleados")
def empleados():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    cursor.execute("SELECT idDepartamento, NombreDepartamento FROM departamento ORDER BY NombreDepartamento ASC")
    departamentos = cursor.fetchall()
    con.close()
    return render_template("empleados.html", departamentos=departamentos)

@app.route("/tbodyEmpleados")
def tbodyEmpleados():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    sql = """
    SELECT 
        E.idEmpleado, E.nombreEmpleado, E.numero, E.fechaIngreso, 
        E.idDepartamento, D.NombreDepartamento 
    FROM empleados AS E
    INNER JOIN departamento AS D ON E.idDepartamento = D.idDepartamento
    ORDER BY E.idEmpleado DESC
    """
    cursor.execute(sql)
    registros = cursor.fetchall()
    con.close()
    return render_template("tbodyEmpleados.html", empleados=registros)

@app.route("/empleado", methods=["POST"])
def guardarEmpleado():
    # MEJORA: Se usa .get() para más seguridad y se añade manejo de errores.
    idEmpleado = request.form.get("idEmpleado")
    nombreEmpleado = request.form.get("nombreEmpleado")
    numero = request.form.get("numero")
    fechaIngreso = request.form.get("fechaIngreso")
    idDepartamento = request.form.get("idDepartamento")

    if not all([nombreEmpleado, numero, fechaIngreso, idDepartamento]):
        return make_response(jsonify({"error": "Faltan datos requeridos."}), 400)

    con = None
    try:
        con = mysql.connector.connect(**db_config)
        cursor = con.cursor()
        
        if idEmpleado:
            sql = "UPDATE empleados SET nombreEmpleado = %s, numero = %s, fechaIngreso = %s, idDepartamento = %s WHERE idEmpleado = %s"
            val = (nombreEmpleado, numero, fechaIngreso, idDepartamento, idEmpleado)
        else:
            sql = "INSERT INTO empleados (nombreEmpleado, numero, fechaIngreso, idDepartamento) VALUES (%s, %s, %s, %s)"
            val = (nombreEmpleado, numero, fechaIngreso, idDepartamento)
        
        cursor.execute(sql, val)
        con.commit()
        
        # NUEVO: Se notifica a los clientes del cambio a través de Pusher.
        pusherEmpleados()
        
        return make_response(jsonify({"message": "Operación exitosa"}), 200)

    except mysql.connector.Error as err:
        if con: con.rollback()
        return make_response(jsonify({"error": f"Error de base de datos: {err}"}), 500)

    finally:
        if con and con.is_connected():
            cursor.close()
            con.close()

# =========================================================================
# MÓDULO ASISTENCIAS (Sin cambios, ya estaba bien)
# =========================================================================
@app.route("/asistencias")
def asistencias():
    return render_template("asistencias.html")

@app.route("/tbodyAsistencias")
def tbodyAsistencias():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    sql = "SELECT idAsistencia, fecha, comentarios FROM asistencias ORDER BY idAsistencia DESC"
    cursor.execute(sql)
    registros = cursor.fetchall()
    con.close()
    return render_template("tbodyAsistencias.html", asistencias=registros)

@app.route("/asistencia", methods=["POST"])
def guardarAsistencia():
    # Esta ruta puede mejorarse con manejo de errores como en guardarEmpleado
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor()
    fecha = request.form["fecha"]
    comentarios = request.form["comentarios"]
    sql = "INSERT INTO asistencias (fecha, comentarios) VALUES (%s, %s)"
    val = (fecha, comentarios)
    cursor.execute(sql, val)
    con.commit()
    cursor.close()
    con.close()
    pusherAsistencias()
    return make_response(jsonify({}))

# =========================================================================
# MÓDULO ASISTENCIAS/PASES
# =========================================================================

@app.route("/asistenciaspases")
def asistenciaspases():
    # Ahora consultamos tanto empleados como asistencias para los <select>
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    
    # Obtener empleados
    cursor.execute("SELECT idEmpleado, nombreEmpleado FROM empleados ORDER BY nombreEmpleado ASC")
    empleados = cursor.fetchall()
    
    # Obtener asistencias (fechas)
    cursor.execute("SELECT idAsistencia, fecha, comentarios FROM asistencias ORDER BY fecha DESC")
    asistencias = cursor.fetchall()
    
    con.close()
    
    # Pasamos AMBAS listas al template
    return render_template("asistenciaspases.html", empleados=empleados, asistencias=asistencias)


@app.route("/tbodyAsistenciasPases")
def tbodyAsistenciasPases():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    # CORRECCIÓN: Se añade AP.idAsistencia a la consulta para el botón de editar
    sql = """
    SELECT 
        AP.idAsistenciaPase, 
        AP.idEmpleado, 
        AP.idAsistencia, -- <--- AÑADIDO
        E.nombreEmpleado, 
        A.fecha AS fechaAsistencia, 
        AP.estado
    FROM asistenciaspases AS AP
    INNER JOIN empleados AS E ON E.idEmpleado = AP.idEmpleado
    INNER JOIN asistencias AS A ON A.idAsistencia = AP.idAsistencia -- <--- JOIN CORREGIDO
    ORDER BY AP.idAsistenciaPase DESC
    """
    cursor.execute(sql)
    registros = cursor.fetchall()
    cursor.close()
    con.close()
    return render_template("tbodyAsistenciasPases.html", asistenciaspases=registros)

# --- RUTA UNIFICADA PARA CREAR Y ACTUALIZAR (MODIFICADA) ---
@app.route("/asistenciapase", methods=["POST"])
def guardarAsistenciaPase():
    con = None
    try:
        idAsistenciaPase = request.form.get("idAsistenciaPase")
        idEmpleado = request.form.get("idEmpleado")
        idAsistencia = request.form.get("idAsistencia") # <-- AHORA RECIBIMOS idAsistencia
        estado = request.form.get("selEstado")

        if not all([idEmpleado, idAsistencia, estado]):
            return make_response(jsonify({"error": "Faltan datos requeridos."}), 400)

        con = mysql.connector.connect(**db_config)
        cursor = con.cursor()
        
        if idAsistenciaPase:
            # Lógica de Actualización
            sql = "UPDATE asistenciaspases SET idEmpleado = %s, idAsistencia = %s, estado = %s WHERE idAsistenciaPase = %s"
            val = (idEmpleado, idAsistencia, estado, idAsistenciaPase)
        else:
            # Lógica de Creación
            sql = "INSERT INTO asistenciaspases (idEmpleado, idAsistencia, estado) VALUES (%s, %s, %s)"
            val = (idEmpleado, idAsistencia, estado)

        cursor.execute(sql, val)
        con.commit()
        
        pusherAsistenciasPases() 
        
        return make_response(jsonify({"message": "Operación exitosa"}), 200)

    except mysql.connector.Error as err:
        if con: con.rollback()
        return make_response(jsonify({"error": f"Error de base de datos: {err}"}), 500)

    finally:
        if con and con.is_connected():
            cursor.close()
            con.close()

# =========================================================================
# MÓDULO DEPARTAMENTOS
# =========================================================================
@app.route("/departamentos")
def departamentos():
    return render_template("departamentos.html")

@app.route("/tbodyDepartamentos")
def tbodyDepartamentos():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    sql = "SELECT idDepartamento, NombreDepartamento, Edificio, Descripcion FROM departamento ORDER BY idDepartamento DESC"
    cursor.execute(sql)
    registros = cursor.fetchall()
    con.close()
    return render_template("tbodyDepartamentos.html", departamentos=registros)

# Faltaba la ruta para guardar/editar departamentos, aquí está:
@app.route("/departamento", methods=["POST"])
def guardarDepartamento():
    idDepartamento = request.form.get("idDepartamento")
    nombre = request.form.get("txtNombreDepartamento")
    edificio = request.form.get("txtEdificio")
    descripcion = request.form.get("txtDescripcion")

    con = mysql.connector.connect(**db_config)
    cursor = con.cursor()

    if idDepartamento:
        sql = "UPDATE departamento SET NombreDepartamento = %s, Edificio = %s, Descripcion = %s WHERE idDepartamento = %s"
        val = (nombre, edificio, descripcion, idDepartamento)
    else:
        sql = "INSERT INTO departamento (NombreDepartamento, Edificio, Descripcion) VALUES (%s, %s, %s)"
        val = (nombre, edificio, descripcion)
    
    cursor.execute(sql, val)
    con.commit()
    cursor.close()
    con.close()
    pusherDepartamentos()
    
    return make_response(jsonify({"status": "success"}))
