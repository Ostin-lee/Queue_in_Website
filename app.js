const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
var bodyParser = require('body-parser');
var waterfall = require('async-waterfall');

var total_queue_gateway = [];
var total_queue_main = [];

const max_buffer = 2;
var con_orgin;

var created_socket_id;

app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

app.use(express.static("public"));

app.use(session({
	secret: 'secret',
	resave: true,
    saveUninitialized: true
}));

const auth = function(req, res, next){
    if (req.session.loggedin)
        return next();
    else
		res.redirect('/');
};

app.post('/logout', function (req, res){
    req.session.destroy();
    res.end();
});
/*
const auth = function(req, res, next){
    if (req.session.loggedin)
        return next();
    else
		res.redirect('/');
};

app.use(session({
	secret: 'secret',
	resave: true,
    saveUninitialized: true
}));

app.get('/auth', function(req, res){
    req.session.loggedin = true;
    res.redirect('/target');
});

app.get('/logout', function (req, res){
    req.session.destroy();
    res.redirect('/');
});
*/

//myVar = setTimeout(function, milliseconds);
//clearTimeout(myVar);

io.on('connection', (socket) => {

    waterfall([

        function(Callback){

            con_orgin = socket.handshake.headers.referer;
            
            console.log('a new user with id ' + socket.id + ' has entered');
            created_socket_id = socket.id;
            
            if(con_orgin==="http://localhost:3000/"){
                total_queue_gateway.push(created_socket_id);
            } else {
                total_queue_main.push(created_socket_id);
            }
            /*
            let initial_show_cnt = total_queue_gateway.length - max_buffer;
            if(initial_show_cnt < 0) initial_show_cnt = 0;
            */
            io.to(created_socket_id).emit('init', created_socket_id, total_queue_gateway.length + max_buffer);

            if(max_buffer - total_queue_main.length > 0){
                io.to(created_socket_id).emit('move');
            } else {
                io.to(created_socket_id).emit('wait');
            }


            Callback(null);
        }], 
        function (err, result) {
            //console.log('error');
        });

    socket.on('disconnect', () => {

        //Main 큐에 있는 사용자가 나갈 때 마다 Gateway 큐에서 사용자를 불러온다,
        console.log('user with id ' + socket.id + " disconnected");

        let sliding_cnt = max_buffer - total_queue_main.length;
        if(sliding_cnt < 0) sliding_cnt = 0;

        waterfall([               
            function(Callback){

                total_queue_gateway = total_queue_gateway.filter(function(item) {
                   return item !== socket.id;
                }); 

                Callback(null);
            }, 
            function(Callback){

                //여기서 순서에 따라 접속 해줄 사함이랑 대기 번호 업데이트 해준다.
                if(total_queue_main.indexOf(socket.id)>-1){

                    io.to(total_queue_gateway.shift()).emit('move');

                    for(let i = 0; i < total_queue_gateway.length; i++){
                        if(total_queue_gateway[i]!==undefined){
                            io.to(total_queue_gateway[i]).emit('wait');
                        }                        
                    }
                }
  
                Callback(null);
            },
            function(Callback){

                total_queue_main = total_queue_main.filter(function(item) {
                    return item !== socket.id;
                }); 

            }], 
            function (err, result) {
                //console.log('error');
           });            
        
        });       
                
    });
    
app.get('/', function(req, res) {
    res.sendFile(path.join(__dirname + '/public/html/legacy_before.html'));
});

app.post('/auth', function(req, res) {
    //req.body.sid
    req.session.loggedin = true;
    res.redirect('/target');
/*
    if(total_queue.indexOf(req.body.sid)>-1){
        res.end(JSON.stringify("success"));
    } else {
        res.end(JSON.stringify("fail"));
    }
*/
});

app.get('/target', auth, function(req, res) {
    res.sendFile(path.join(__dirname + '/public/html/target.html'));
});

http.listen(3000, () => {
    console.log('Connected at 3000');
});
