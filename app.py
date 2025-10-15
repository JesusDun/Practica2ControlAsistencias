# python.exe -m venv .venv
# cd .venv/Scripts
# activate.bat
# py -m ensurepip --upgrade
# pip install -r requirements.txt
# pip install flask-login

import os
from functools import wraps
from flask import Flask, render_template, request, jsonify, make_response, redirect, url_for, flash

# --- Importaciones de Flask-Login ---
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user

import mysql.connector
from flask_cors import CORS
import pusher

# --- Configuración de la base de datos ---
db_config = {
    "host": "185.232.14.52",
    "database": "u760464709_23005019_bd",
    "user": "u760464709_23005019_usr",
    "password": "]0Pxl25["
}

app = Flask(__name__)
CORS(app)
app.config['SECRET_KEY'] = os.urandom(24) 

# --- CONFIGURACIÓN DE PUSHER ---
pusher_client = pusher.Pusher(
    app_id='2048531',
    key='686124f7505c58418f23',
    secret='b5add38751c68986fc11',
    cluster='us2',
    ssl=True
)

# --- CONFIGURACIÓN DE FLASK-LOGIN ---
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'appLogin'
login_manager.login_message = "Por favor, inicia sesión para acceder a esta página."
login_manager.login_message_category = "warning"

# --- Modelo de Usuario para Flask-Login ---
class User(UserMixin):
    def __init__(self, id, username, role):
        self.id = id
        self.username = username
        self.role = role

    @staticmethod
    def get(user_id):
        con = None
        try:
            con = mysql.connector.connect(**db_config)
            cursor = con.cursor(dictionary=True)
            cursor.execute("SELECT idUsuario, username, role FROM usuarios WHERE idUsuario = %s", (user_id,))
            user_data = cursor.fetchone()
            if not user_data:
                return None
            return User(id=user_data['idUsuario'], username=user_data['username'], role=user_data['role'])
        except mysql.connector.Error:
            return None
        finally:
            if con and con.is_connected():
                cursor.close()
                con.close()

@login_manager.user_loader
def load_user(user_id):
    return User.get(user_id)

# --- Decorador para verificar roles ---
def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated or current_user.role not in roles:
                flash("No tienes permiso para acceder a esta página.", "danger")
                return redirect(url_for('dashboard'))
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# --- Funciones de Pusher ---
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
def landingPage():
    return render_template("landing-page.html")

@app.route("/dashboard")
@login_required
def dashboard():
    return render_template("dashboard.html")

@app.route("/login", methods=['GET', 'POST'])
def appLogin():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        usuario_ingresado = request.form.get("txtUsuario")
        contrasena_ingresada = request.form.get("txtContrasena")

        if not usuario_ingresado or not contrasena_ingresada:
            flash("Usuario y contraseña son requeridos.", "danger")
            return redirect(url_for('appLogin'))
        
        con = None
        try:
            con = mysql.connector.connect(**db_config)
            cursor = con.cursor(dictionary=True)
            sql = "SELECT idUsuario, username, password, role FROM usuarios WHERE username = %s"
            cursor.execute(sql, (usuario_ingresado,))
            user_data = cursor.fetchone()

            # --- CAMBIO IMPORTANTE: Comparación directa de contraseñas ---
            if user_data and contrasena_ingresada == user_data['password']:
                user_obj = User(id=user_data['idUsuario'], username=user_data['username'], role=user_data['role'])
                login_user(user_obj)
                return redirect(url_for('dashboard'))
            else:
                flash("Usuario o Contraseña Incorrectos", "danger")
                return redirect(url_for('appLogin'))
        except mysql.connector.Error as err:
            flash(f"Error de base de datos: {err}", "danger")
            return redirect(url_for('appLogin'))
        except Exception as e:
            flash(f"Ha ocurrido un error inesperado: {e}", "danger")
            return redirect(url_for('appLogin'))
        finally:
            if con and con.is_connected():
                cursor.close()
                con.close()

    return render_template("login.html")

@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Has cerrado sesión exitosamente.", "success")
    return redirect(url_for('appLogin'))

# =========================================================================
# MÓDULOS PROTEGIDOS
# =========================================================================

@app.route("/empleados")
@login_required
@role_required(['Administrador'])
def empleados():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    cursor.execute("SELECT idDepartamento, NombreDepartamento FROM departamento ORDER BY NombreDepartamento ASC")
    departamentos = cursor.fetchall()
    con.close()
    return render_template("empleados.html", departamentos=departamentos)


@app.route("/tbodyEmpleados")
@login_required
@role_required(['Administrador'])
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
@login_required
@role_required(['Administrador'])
def guardarEmpleado():
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
        
        pusherEmpleados()
        
        return make_response(jsonify({"message": "Operación exitosa"}), 200)

    except mysql.connector.Error as err:
        if con: con.rollback()
        return make_response(jsonify({"error": f"Error de base de datos: {err}"}), 500)

    finally:
        if con and con.is_connected():
            cursor.close()
            con.close()

@app.route("/asistencias")
@login_required
def asistencias():
    return render_template("asistencias.html")

@app.route("/tbodyAsistencias")
@login_required
def tbodyAsistencias():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    sql = "SELECT idAsistencia, fecha, comentarios FROM asistencias ORDER BY idAsistencia DESC"
    cursor.execute(sql)
    registros = cursor.fetchall()
    con.close()
    return render_template("tbodyAsistencias.html", asistencias=registros)

@app.route("/asistencia", methods=["POST"])
@login_required
def guardarAsistencia():
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

@app.route("/asistenciaspases")
@login_required
def asistenciaspases():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    cursor.execute("SELECT idEmpleado, nombreEmpleado FROM empleados ORDER BY nombreEmpleado ASC")
    empleados = cursor.fetchall()
    cursor.execute("SELECT idAsistencia, fecha, comentarios FROM asistencias ORDER BY fecha DESC")
    asistencias = cursor.fetchall()
    con.close()
    return render_template("asistenciaspases.html", empleados=empleados, asistencias=asistencias)


@app.route("/tbodyAsistenciasPases")
@login_required
def tbodyAsistenciasPases():
    busqueda = request.args.get('busqueda', '')
    
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    
    sql = """
    SELECT 
        AP.idAsistenciaPase, AP.idEmpleado, AP.idAsistencia,
        E.nombreEmpleado, A.fecha AS fechaAsistencia, AP.estado
    FROM asistenciaspases AS AP
    INNER JOIN empleados AS E ON E.idEmpleado = AP.idEmpleado
    INNER JOIN asistencias AS A ON A.idAsistencia = AP.idAsistencia
    """
    
    if busqueda:
        sql += " WHERE E.nombreEmpleado LIKE %s"
        cursor.execute(sql, (f"%{busqueda}%",))
    else:
        sql += " ORDER BY AP.idAsistenciaPase DESC"
        cursor.execute(sql)
        
    registros = cursor.fetchall()
    cursor.close()
    con.close()
    return render_template("tbodyAsistenciasPases.html", asistenciaspases=registros)

@app.route("/asistenciapase", methods=["POST"])
@login_required
def guardarAsistenciaPase():
    con = None
    try:
        idAsistenciaPase = request.form.get("idAsistenciaPase")
        idEmpleado = request.form.get("idEmpleado")
        idAsistencia = request.form.get("idAsistencia")
        estado = request.form.get("selEstado")
        if not all([idEmpleado, idAsistencia, estado]):
            return make_response(jsonify({"error": "Faltan datos requeridos."}), 400)
        con = mysql.connector.connect(**db_config)
        cursor = con.cursor()
        if idAsistenciaPase:
            sql = "UPDATE asistenciaspases SET idEmpleado = %s, idAsistencia = %s, estado = %s WHERE idAsistenciaPase = %s"
            val = (idEmpleado, idAsistencia, estado, idAsistenciaPase)
        else:
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

@app.route("/asistenciapase/<idAsistenciaPase>", methods=["DELETE"])
@login_required
def eliminarAsistenciaPase(idAsistenciaPase):
    con = None
    try:
        con = mysql.connector.connect(**db_config)
        cursor = con.cursor()
        sql = "DELETE FROM asistenciaspases WHERE idAsistenciaPase = %s"
        val = (idAsistenciaPase,)
        cursor.execute(sql, val)
        con.commit()
        pusherAsistenciasPases() 
        return make_response(jsonify({"message": "Registro eliminado exitosamente"}), 200)
    except mysql.connector.Error as err:
        if con: con.rollback()
        return make_response(jsonify({"error": f"Error de base de datos: {err}"}), 500)
    finally:
        if con and con.is_connected():
            cursor.close()
            con.close()

@app.route("/departamentos")
@login_required
@role_required(['Administrador'])
def departamentos():
    return render_template("departamentos.html")

@app.route("/tbodyDepartamentos")
@login_required
@role_required(['Administrador'])
def tbodyDepartamentos():
    con = mysql.connector.connect(**db_config)
    cursor = con.cursor(dictionary=True)
    sql = "SELECT idDepartamento, NombreDepartamento, Edificio, Descripcion FROM departamento ORDER BY idDepartamento DESC"
    cursor.execute(sql)
    registros = cursor.fetchall()
    con.close()
    return render_template("tbodyDepartamentos.html", departamentos=registros)

@app.route("/departamento", methods=["POST"])
@login_required
@role_required(['Administrador'])
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

if __name__ == '__main__':
    app.run(debug=True, port=5001)

