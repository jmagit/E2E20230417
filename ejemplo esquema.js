var schema = {
    "definitions": {},
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "https://example.com/object1682434113.json",
    "title": "Root",
    "type": "array",
    "default": [],
    "items": {
        "type": "object",
        "required": [
            "id",
            "nombre"
        ],
        "properties": {
            "id": {
                "$id": "#root/id",
                "title": "Id",
                "type": "integer",
                "default": 0
            },
            "nombre": {
                "$id": "#root/nombre",
                "title": "Nombre",
                "type": "string",
                "default": "",
                "pattern": "^.*$"
            },
            "apellidos": {
                "$id": "#root/apellidos",
                "title": "Apellidos",
                "type": "string",
                "default": "",
                "pattern": "^.*$"
            },
            "correo": {
                "$id": "#root/correo",
                "title": "Correo",
                "type": "string",
                "default": "",
                "pattern": "^[^@]+@[^@]+\.[a-zA-Z]{2,}$"
            },
            "telefono": {
                "$id": "#root/telefono",
                "title": "Telefono",
                "type": "array",
                "default": [],
                "items": {
                    "$id": "#root/telefono/items",
                    "title": "Items",
                    "type": "string",
                    "default": "",
                    "pattern": "^.*$"
                }
            },
            "edad": {
                "$id": "#root/edad",
                "title": "Edad",
                "type": "integer",
                "minimum": 16,
                "maximum": 67,
                "default": 0
            }
        }
    }
};

pm.test('Schema is valid', function () {
    pm.response.to.have.jsonSchema(schema);
});


pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

var template = `
    <table bgcolor="#FFFFFF">
        <tr><th>Id</th><th>Nombre</th><th>Apellidos</th></tr>
        {{#each response}}
            <tr><td>{{id}}</td><td>{{nombre}}</td><td>{{apellidos}}</td></tr>
        {{/each}}
    </table>
`;
pm.visualizer.set(template, { response: pm.response.json() });
