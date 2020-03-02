const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

var total_queue_gateway = [];
var total_queue_main = [];

const max_buffer = 2;
var con_orgin;

var created_socket_id;

app.use(express.static("public"));

app.use(session({
	secret: 'secret-key',
	resave: true,
    saveUninitialized: true
}));

const auth = function(req, res, next){
    if (req.session.loggedin)
        return next();
    else
		res.redirect('/');
};

app.post('/session_close', function (req, res){
    req.session.destroy();
    res.end();
});

io.on('connection', (socket) => {

    con_orgin = socket.handshake.headers.referer;
    
    created_socket_id = socket.id;
    
    if(con_orgin==="http://localhost:3000/"){
        total_queue_gateway.push(created_socket_id);
    } else {
        total_queue_main.push(created_socket_id);
    }

    io.to(created_socket_id).emit('init', total_queue_gateway.length + max_buffer);

    if(max_buffer - total_queue_main.length > 0){
        io.to(created_socket_id).emit('redirect');
    } else {
        io.to(created_socket_id).emit('wait');
    }

    socket.on('disconnect', () => {

        total_queue_gateway = total_queue_gateway.filter(function(item) {
            return item !== socket.id;
        }); 

        if(total_queue_main.indexOf(socket.id)>-1){

            io.to(total_queue_gateway.shift()).emit('redirect');

            for(let i = 0; i < total_queue_gateway.length; i++){
                if(total_queue_gateway[i]!==undefined){
                    io.to(total_queue_gateway[i]).emit('wait');
                }                        
            }
        }

        total_queue_main = total_queue_main.filter(function(item) {
            return item !== socket.id;
        }); 

    });       
                
});
    
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/html/gateway.html'));
});

app.post('/auth', function(req, res) {
    req.session.loggedin = true;
    res.redirect('/target');
});

app.get('/target', auth, function(req, res) {
    res.sendFile(path.join(__dirname + '/public/html/target.html'));
});

http.listen(3000, () => {
    console.log('Connected at 3000');
});
