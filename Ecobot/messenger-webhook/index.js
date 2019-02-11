
// Importar las dependencias para configurar el servidor
var express = require("express");
var request = require("request");
var bodyParser = require("body-parser");

var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
// configurar el puerto y el mensaje en caso de exito
app.listen((process.env.PORT || 5000), () => console.log('El servidor webhook esta escchando!'));

// Ruta de la pagina index
app.get("/", function (req, res) {
    res.send("Se ha desplegado de manera exitosa ECOBOT :p!!!");
});

// Facebook Webhook

// Usados para la verificacion
app.get("/webhook", function (req, res) {
    // Verificar la coincidendia del token
    if (req.query["hub.verify_token"] === process.env.VERIFICATION_TOKEN) {
        // Mensaje de exito y envio del token requerido
        console.log("webhook verificado!");
        res.status(200).send(req.query["hub.challenge"]);
    } else {
        // Mensaje de fallo
        console.error("La verificacion ha fallado, porque los tokens no coinciden");
        res.sendStatus(403);
    }
});

// Todos eventos de mesenger sera apturados por esta ruta
app.post("/webhook", function (req, res) {
    // Verificar si el vento proviene del pagina asociada
    if (req.body.object == "page") {
        // Si existe multiples entradas entraas
        req.body.entry.forEach(function(entry) {
            // Iterara todos lo eventos capturados
            //entry.messaging.forEach(function(event) { //Original ForEach
                // if (event.message) {
                    // process_event(event);
                // }
            // });
			
			//Obtiene mensaje.
			//entry.messaging es array con un solo mensaje
			//obtener pos 0
			let webhook_event = entry.messaging[0];
			console.log(webhook_event);
			
			//obtener PSID de remitente
			let sender_psid = webhook_event.sender.id;
			console.log('Sender PSID' + sender_psid);
			
			//verificar si es mensaje o respuesta
			if (webhook_event.message) {
				handleMessage(sender_psid, webhook_event.message);
			} else if (webhook_event.postback){
				handlePostback(sender_psid, webhook_event.postback)
			}
        });
        res.sendStatus(200);
    }else{
		//return 404 not Found, si evento no es de sucripcion a la pagina
		res.sendStatus(404);
	}
});

//eventos de mensajes
function handleMessage(sender_psid, received_message)
{
	let response;

    //verificar si el msj tiene texto
    if (received_message.text)
    {
        //manejar nlp
        const greeting = firstEntity(received_message.nlp, 'greetings');
        const goodbye = firstEntity(received_message.nlp, 'bye');
        if (greeting && greeting.confidence > 0.8)
        {
            //crear menu
            let image = 'https://cdn3.iconfinder.com/data/icons/customer-support-7/32/40_robot_bot_customer_help_support_automatic_reply-512.png';
            let buttons = [
                {
                    "type": "postback",
                    "title": "Services",
                    "payload": "servicios",
                },
                {
                    "type": "postback",
                    "title": "About Us",
                    "payload": "quees",
                },
                {
                    "type": "postback",
                    "title": "Open Positions",
                    "payload": "trabajo",
                }
            ];
            response = CreateMenu("¡Hello! How can I help you?","Choose an option.", image, buttons)
        }
        else if(goodbye && goodbye.confidence > 0.8)
        {
            response = {
                "text" : "Good Bye my friend!"
            }
        }
        else
        {
            response = {
                    "text": `Sorry I didn't get that: \n  "${received_message.text}".`
            }
        }
    }
    else if (received_message.attachments)
    {
        //attachments
        let attachment = received_message.attachments[0];
        if (attachment.type === 'file')
        {
            //correct format
            response = {
                'text' : "Thanks! We'll contact you shortly.\n*Welcome to EcoBOT!*"
            }
        }
        else 
        {
            //not the correct format
            response = {
                'text' : 'Please re-send us your resume on PDF or on a DOC format.'
            }
        }
        let attachment_url = attachment.payload.url;
    }
    //manda el msj de respuesta
    callSendAPI(sender_psid, response);
}

// Handles messaging_postbacks events
function handlePostback(sender_psid, received_postback)
{
    let response;

    //obtener payload
    let payload = received_postback.payload;

    //responder de acuerdo al postback
    if (payload === 'trabajo')
    {        
        let buttons = [
            {
                "type": "postback",
                "title": "Open position-0",
                "payload": "trabajo.0",
            },
            {
                "type": "postback",
                "title": "Open position-1",
                "payload": "trabajo.1",
            },
            {
                "type": "postback",
                "title": "Open position-2",
                "payload": "trabajo.2",
            }
        ];
        response = CreateMenu("Open Positions", "Choose an option", "",buttons);
        // response = { "text": "Estas son nuestras vacanes:\n Si te interesó alguna, arrastra tu CV a la conversación y nos pondrémos en contacto"}
    }
    else if (payload === 'servicios')
    {
        response = { 
            "text": "*Team Enhacement:* Some inspiring text"
        }
    }
    else if (payload === 'quees')
    {
        response = { "text": "More inspiring text"
        }
    }
    else if(payload.indexOf('trabajo.') > -1 )
    {
        let iVac = payload.split('.');
        response = { "text": "Open Position:"+iVac[1] + 
            ". If you're intersted on this open position attach your resume to this conversation, write your phone and email and we'll contact you to start the process."
        }
    }
    //envair el msj
    callSendAPI(sender_psid, response);
}

// Sends response messages via the Send API
function callSendAPI(sender_psid, response)
{
    //construir cuerpo del msj
    let request_body = {
        "recipient": {
                "id": sender_psid
        },
        "message": response
    }

    //enviar peticion HTTP a Messenger
    request({
        "uri": "https://graph.facebook.com/v2.6/me/messages",
        "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
        "method": "POST",
        "json": request_body
    }, (err, res, body) => {
        if(!err){
            console.log('message sent!');
        } else {
            console.error("error sending the message!:"+err);
        }
    });
}

function firstEntity(nlp, name)
{
    return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
}

function CreateMenu(title, subtitle, image, buttons)
{
    let response = {
        "attachment": {
            "type": "template",
            "payload": {
                "template_type": "generic",
                "elements": [{
                    "title": title,
                    "subtitle": subtitle,
                    "image_url": image
                }]
            }
        }
    }

    if (buttons != null && buttons.length > 0)
    {
        response.attachment.payload.elements[0].buttons = [];
        buttons.forEach(function (value) {
            let btn = {};
            btn.type = value.type;
            btn.title = value.title;
            btn.payload = value.payload;
            response.attachment.payload.elements[0].buttons.push(btn);
        });
    }

    return response;
}


// // Funcion donde se procesara el evento
// function process_event(event){
    // // Capturamos los datos del que genera el evento y el mensaje 
    // var senderID = event.sender.id;
    // var message = event.message;
    
    // // Si en el evento existe un mensaje de tipo texto
    // if(message.text){
        // // Crear un payload para un simple mensaje de texto
        // var response = {
            // "text": 'Enviaste este mensaje: ' + message.text
        // }
    // }
    
    // // Enviamos el mensaje mediante SendAPI
    // enviar_texto(senderID, response);
// }

// Funcion donde el chat respondera usando SendAPI
// function enviar_texto(senderID, response){
    // // Construcicon del cuerpo del mensaje
    // let request_body = {
        // "recipient": {
          // "id": senderID
        // },
        // "message": response
    // }
    
    // // Enviar el requisito HTTP a la plataforma de messenger
    // request({
        // "uri": "https://graph.facebook.com/v2.6/me/messages",
        // "qs": { "access_token": process.env.PAGE_ACCESS_TOKEN },
        // "method": "POST",
        // "json": request_body
    // }, (err, res, body) => {
        // if (!err) {
          // console.log('Mensaje enviado!')
        // } else {
          // console.error("No se puedo enviar el mensaje:" + err);
        // }
    // }); 
// }