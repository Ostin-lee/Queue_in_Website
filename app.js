const express = require('express');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

var total_queue_gateway = [];
var total_queue_main = [];

const max_buffer = 2;
var conn_orgin;

var created_socket_id;

app.use(express.static("public"));

io.on('connection', (socket) => {

    conn_orgin = socket.handshake.headers.referer;
    
    created_socket_id = socket.id;
    
    if(conn_orgin==="http://localhost:3000/"){
        total_queue_gateway.push(created_socket_id);
    } else {
        if(total_queue_main.length >= max_buffer){
            io.to(created_socket_id).emit('unauthorized');
        } else {
            total_queue_main.push(created_socket_id);
        }
    }

    io.to(created_socket_id).emit('init', total_queue_gateway.length + total_queue_main.length - max_buffer);

    if(max_buffer - total_queue_main.length > 0){
        io.to(created_socket_id).emit('forward');
    } else {
        io.to(created_socket_id).emit('wait');
    }

    socket.on('disconnect', () => {

        total_queue_gateway = total_queue_gateway.filter(function(item) {
            return item !== socket.id;
        }); 

        if(total_queue_main.indexOf(socket.id)>-1){

            io.to(total_queue_gateway.shift()).emit('forward');

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

app.get('/target', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/html/target.html'));
});

http.listen(3000, () => {
    console.log('Connected at 3000');
});
