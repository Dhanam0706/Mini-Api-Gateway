const fastify=require('fastify')({logger:true});

fastify.get('/users',async(req,reply)=>{
    return {
        service:"USER SERVICE",
        users:["Dhanam","Venu","Deepak","Sathya"]
    }
})
fastify.listen({port:4003},(err)=>{
    if(err)
        console.log("ERROR:"+err);
    console.log("User Service Listening");
})