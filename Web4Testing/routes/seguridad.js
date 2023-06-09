const express = require('express');
const router = express.Router();
const { createHash } = require('crypto')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const fs = require('fs/promises');
const { generateErrorByStatus, generateError, generateErrorByError } = require('./utils')
const APP_SECRET = 'Es segura al 99%'
const AUTHENTICATION_SCHEME = 'Bearer '
const PROP_USERNAME = 'idUsuario'
const PROP_PASSWORD = 'password'
const PROP_NAME = 'nombre'
const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*\W).{8,}$/
const USR_FILENAME = './data/usuarios.json'

module.exports = router

// Middleware: Cross-origin resource sharing (CORS)
module.exports.useCORS = (req, res, next) => {
    let origen = req.header("Origin")
    if (!origen) origen = '*'
    res.header('Access-Control-Allow-Origin', origen)
    res.header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, X-Requested-With, X-XSRF-TOKEN')
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.header('Access-Control-Allow-Credentials', 'true')
    next()
}

// Middleware: Autenticación
module.exports.useAuthentication = (req, res, next) => {
    res.locals.isAuthenticated = false;
    let token = ''
    if (!req.headers['authorization']) {
        if (!req.cookies['Authorization']) {
            next();
            return;
        }
        token = req.cookies['Authorization'];
    } else
        token = req.headers['authorization'].substring(AUTHENTICATION_SCHEME.length)
    try {
        let decoded = jwt.verify(token, APP_SECRET);
        res.locals.isAuthenticated = true;
        res.locals.usr = decoded.usr;
        res.locals.name = decoded.name;
        res.locals.roles = decoded.roles;
        res.locals.isInRole = role => res.locals.roles.includes(role)
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError')
            return next(generateError('Invalid token', 401, 'Token expired', { expiredAt: err.expiredAt }))
        return next(generateError('Invalid token', 401))
    }
}
// Middleware: Autorización
module.exports.onlyAuthenticated = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next()
    }
    if (!res.locals.isAuthenticated) {
        return next(generateErrorByStatus(401))
    }
    next()
}
module.exports.onlyInRole = (roles) => (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next()
    }
    if (!res.locals.isAuthenticated) {
        return next(generateErrorByStatus(401))
    }

    if (roles.split(',').some(role => res.locals.isInRole(role))) {
        next()
    } else {
        return next(generateErrorByStatus(403))
    }
}
module.exports.onlySelf = (_req, res, next) => {
    res.locals.onlySelf = true;
    next()
}
module.exports.readOnly = (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'OPTIONS' && !res.locals.isAuthenticated) {
        return next(generateErrorByStatus(401))
    }
    next()
}

const isSelf = (res, id) => {
    return !res.locals.onlySelf || !id || id == res.locals.usr
}
module.exports.isSelf = isSelf

// Middleware: Cross-Site Request Forgery (XSRF)
module.exports.generateXsrfToken = (req) => {
    const hash = createHash('sha256')
    let client = `${req.client.remoteFamily}-${req.client.remoteAddress}`
    hash.update(client)
    return hash.digest('base64')
}
function generateXsrfCookie(req, res) {
    res.cookie('XSRF-TOKEN', module.exports.generateXsrfToken(req), { httpOnly: false, maxAge: 30 * 60 * 1000 })
}
function isInvalidXsrfToken(req) {
    let token = req.headers['x-xsrf-token'] || req.body['xsrftoken']
    let cookie = req.cookies['XSRF-TOKEN']
    let secret = module.exports.generateXsrfToken(req)
    return !token || cookie !== token || token !== secret
}
// Middleware: Cookie-to-Header Token
module.exports.useXSRF = (req, res, next) => {
    if (!req.cookies['XSRF-TOKEN'])
        generateXsrfCookie(req, res)
    if ('POST|PUT|DELETE|PATCH'.indexOf(req.method.toUpperCase()) >= 0 && isInvalidXsrfToken(req)) {
        if (req.cookies['XSRF-TOKEN'] !== module.exports.generateXsrfToken(req))
            generateXsrfCookie(req, res)
        return next(generateError('Invalid XSRF-TOKEN', 401))
    }
    res.XsrfToken = module.exports.generateXsrfToken(req)
    next()
}

// Rutas: Control de acceso
async function encriptaPassword(password) {
    const salt = await bcrypt.genSalt(10)
    return bcrypt.hash(password, salt)
}

module.exports.generarTokenJWT = (usuario) => {
    return jwt.sign({
        usr: usuario[PROP_USERNAME],
        name: usuario.nombre,
        roles: usuario.roles
    }, APP_SECRET, { expiresIn: '1h' })

}
module.exports.generarTokenScheme = (usuario) => {
    return AUTHENTICATION_SCHEME + module.exports.generarTokenJWT(usuario)
}
/**
* @swagger
* tags:
*   - name: autenticación
*     description: Login
*   - name: registro
*     description: Cuentas de usuarios
*/
/**
 * @swagger
 * components:
 *  schemas:
 *    Login:
 *      description: Credenciales de autenticación
 *      type: object
 *      required:
 *        - username
 *        - password
 *      properties:
 *        username:
 *          type: string
 *          format: email
 *        password:
 *          type: string
 *          format: password
 *    RespuestaLogin:
 *      type: object
 *      title: Respuesta Login
 *      properties:
 *        success:
 *          type: boolean
 *        token:
 *          type: string
 *        name:
 *          type: string
 *        roles:
 *          type: array
 *          items:
 *            type: string
 */
/**
 * @swagger
 *
 * /login:
 *   post:
 *     tags: [ autenticación ]
 *     summary: Iniciar sesión
 *     parameters:
 *       - name: cookie
 *         in: query
 *         required: false
 *         description: 'true para que genere y envíe la cookie'
 *         schema:
 *           type: boolean
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: "#/components/schemas/Login"
 *         application/x-www-form-urlencoded:
 *           schema:
 *             $ref: "#/components/schemas/Login"
 *       required: true
 *     responses:
 *       "200":
 *         headers: 
 *           Set-Cookie:
 *             schema: 
 *               type: string
 *         description: "Resultado de la autenticación"
 *         content:
 *           application/json:
 *             schema:
 *               $ref: "#/components/schemas/RespuestaLogin"
 *       "400":
 *         $ref: "#/components/responses/BadRequest"
 *       "404":
 *         $ref: "#/components/responses/NotFound"
 */
router.post('/login', async function (req, res, next) {
    let payload = {
        success: false
    }
    if (!req.body || !req.body.username || !req.body.password) {
        // setTimeout(() => next(generateErrorByStatus(400)), 1000)
        return next(generateErrorByStatus(400))
    }
    let usr = req.body.username
    let pwd = req.body.password
    if (!PASSWORD_PATTERN.test(pwd)) {
        // setTimeout(() => next(generateErrorByStatus(400)), 1000)
        return next(generateErrorByStatus(400))
    }
    let data = await fs.readFile(USR_FILENAME, 'utf8')
    let list = JSON.parse(data)
    let element = list.find(item => item[PROP_USERNAME] == usr)
    if (element && await bcrypt.compare(pwd, element[PROP_PASSWORD])) {
        let token = module.exports.generarTokenScheme(element)
        payload = {
            success: true,
            token: token,
            name: element[PROP_NAME],
            roles: element.roles
        }
        if (req.query.cookie)
            res.cookie('Authorization', token.substring(AUTHENTICATION_SCHEME.length), { maxAge: 3600000 })
    }
    res.status(200).json(payload)
})

/**
 * @swagger
 *
 * /login:
 *   options:
 *     tags: [ autenticación ]
 *     summary: Sondeo CORS
 *     responses:
 *       "200":
 *         description: "OK"
 *       "404":
 *         $ref: "#/components/responses/NotFound"
 */
 router.options('/login', function (_req, res) {
    res.sendStatus(200)
})

/**
 * @swagger
 *
 * /logout:
 *   post:
 *     tags: [ autenticación ]
 *     summary: Cerrar sesión
 *     responses:
 *       "200":
 *         description: "OK"
 *       "404":
 *         $ref: "#/components/responses/NotFound"
 */
router.all('/logout', function (_req, res) {
    res.clearCookie('Authorization');
    res.sendStatus(200)
})
/**
 * @swagger
 *
 * /auth:
 *   get:
 *     tags: [ autenticación ]
 *     summary: Obtener estado de sesión
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: "OK"
 *         content:
 *          application/json:
 *            schema:
 *              type: object
 *              properties:
 *                isAuthenticated:
 *                  type: boolean
 *                usr:
 *                  type: string
 *                name:
 *                  type: string
 *                roles:
 *                  type: array
 *                  items:
 *                    type: string
 */
router.get('/auth', function (_req, res) {
    res.status(200).json({ isAuthenticated: res.locals.isAuthenticated, usr: res.locals.usr, name: res.locals.name, roles: res.locals.roles })
})
/**
 * @swagger
 *
 * /register:
 *   post:
 *     tags: [ registro ]
 *     summary: Registrar un nuevo usuario
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               idUsuario:
 *                 type: string
 *                 format: email
 *               nombre:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *       required: true
 *     responses:
 *       "201":
 *         description: "Created"
 *       "400":
 *         $ref: "#/components/responses/BadRequest"
 */
router.post('/register', async function (req, res, next) {
    let data = await fs.readFile(USR_FILENAME, 'utf8')
    let list = JSON.parse(data)
    let element = req.body
    if (element[PROP_USERNAME] == undefined) {
        return next(generateError('Falta el nombre de usuario.', 400))
    } else if (list.find(item => item[PROP_USERNAME] == element[PROP_USERNAME])) {
        return next(generateError('El usuario ya existe.', 400))
    } else if (PASSWORD_PATTERN.test(element[PROP_PASSWORD])) {
        element[PROP_PASSWORD] = await encriptaPassword(element[PROP_PASSWORD])
        element.roles = ["Usuarios"]
        list.push(element)
        fs.writeFile(USR_FILENAME, JSON.stringify(list))
            .then(() => { res.sendStatus(201) })
            .catch(err => { return next(generateErrorByError(err, 500)) })
    } else {
        return next(generateError('Formato incorrecto de la password.', 400))
    }
})

const autenticados = express.Router();

autenticados.use(module.exports.onlyAuthenticated)
autenticados.use(module.exports.onlySelf)
/**
 * @swagger
 *
 * /register:
 *   get:
 *     tags: [ registro ]
 *     summary: Consultar su usuario
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       "200":
 *         description: "OK"
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 idUsuario:
 *                   type: string
 *                   format: email
 *                 nombre:
 *                   type: string
 *                 roles:
 *                   type: array
 *                   items:
 *                     type: string
 *       "401":
 *         $ref: "#/components/responses/Unauthorized"
 */
autenticados.get('/', async function (_req, res, next) {
    let usr = res.locals.usr;
    let data = await fs.readFile(USR_FILENAME, 'utf8')
    let list = JSON.parse(data)
    let element = list.find(item => item[PROP_USERNAME] == usr)
    if (element) {
        delete element[PROP_PASSWORD]
        res.status(200).json(element)
    } else {
        return next(generateErrorByStatus(401))
    }
})
/**
 * @swagger
 *
 * /register:
 *   put:
 *     tags: [ registro ]
 *     summary: Modificar el nombre de su usuario
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nombre:
 *                 type: string
 *             required:
 *               - nombre
 *       required: true
 *     responses:
 *       "204":
 *         $ref: "#/components/responses/NoContent"
 *       "403":
 *         $ref: "#/components/responses/Forbidden"
 *       "404":
 *         $ref: "#/components/responses/NotFound"
 */
autenticados.put('/', async function (req, res, next) {
    if (!isSelf(res, req.body.idUsuario))
        return next(generateErrorByStatus(403))
    let element = req.body
    let data = await fs.readFile(USR_FILENAME, 'utf8')
    let list = JSON.parse(data)
    let index = list.findIndex(row => row[PROP_USERNAME] == res.locals.usr)
    if (index == -1) {
        return next(generateErrorByStatus(404))
    } else {
        if (element.nombre)
            list[index].nombre = element.nombre;
        fs.writeFile(USR_FILENAME, JSON.stringify(list))
            .then(() => { res.sendStatus(204) })
            .catch(err => { return next(generateErrorByError(err, 500)) })
    }
})
/**
 * @swagger
 *
 * /register/password:
 *   put:
 *     tags: [ registro ]
 *     summary: Cambiar su contraseña
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     description: Es necesario conocer la contraseña actual antes de cambiarla
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               oldPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *       required: true
 *     responses:
 *       "204":
 *         $ref: "#/components/responses/NoContent"
 *       "400":
 *         $ref: "#/components/responses/BadRequest"
 *       "403":
 *         $ref: "#/components/responses/Forbidden"
 *       "404":
 *         $ref: "#/components/responses/NotFound"
 */
autenticados.put('/password', async function (req, res, next) {
    let element = req.body
    let data = await fs.readFile(USR_FILENAME, 'utf8')
    let list = JSON.parse(data)
    let index = list.findIndex(row => row[PROP_USERNAME] == res.locals.usr)
    if (index == -1) {
        return next(generateErrorByStatus(404))
    } else if (PASSWORD_PATTERN.test(element.newPassword) && await bcrypt.compare(element.oldPassword, list[index][PROP_PASSWORD])) {
        list[index][PROP_PASSWORD] = await encriptaPassword(element.newPassword)
        fs.writeFile(USR_FILENAME, JSON.stringify(list))
            .then(() => { res.sendStatus(204) })
            .catch(err => { return next(generateErrorByError(err, 500)) })
    } else {
        return next(generateError('Invalid data', 400))
    }
})

router.use('/register', autenticados)
