import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

const app=express();
const PORT=process.env.PORT||3000;
const OPENAI_API_KEY=process.env.OPENAI_API_KEY;
const OPENAI_MODEL=process.env.OPENAI_MODEL||"gpt-5.6";
app.use(cors());
app.use(express.json({limit:"12mb"}));

app.get("/api/health",(req,res)=>res.json({ok:true,service:"Animador IA Backend",version:"1.1.0"}));

function templateScript(brief,style="animador",energy="media"){
  const t={
    animador:["¡ATENCIÓN, ATENCIÓN, SEÑORES Y SEÑORAS!","¡No te lo puedes perder! ¡Te esperamos!"],
    fiesta:["¡¡¡PREPÁRATE PARA LA FIESTA!!!","¡¡¡QUE EMPIECE LA FIESTA!!!"],
    comercial:["Atención a todos nuestros amigos y clientes.","Los esperamos. ¡No faltes!"],
    orquesta:["¡Señoras y señores, amantes de la buena música!","¡Recibamos este gran espectáculo con un fuerte aplauso!"]
  }[style]||["¡ATENCIÓN, ATENCIÓN!","¡Te esperamos!"];
  let middle=String(brief).trim();
  if(energy==="alta"||energy==="explosiva") middle=middle.replace(/[.,]/g,"!!!");
  else if(energy==="media") middle=middle.replace(/\./g,"!");
  return `${t[0]}\n\n${middle}\n\n${t[1]}`;
}

app.post("/api/generate-script",(req,res)=>{
  const {brief,style="animador",energy="media"}=req.body||{};
  if(!brief?.trim()) return res.status(400).json({ok:false,error:"Falta el texto del anuncio."});
  res.json({ok:true,script:templateScript(brief,style,energy),engine:"template-v1"});
});

app.post("/api/generate-script-from-image",async(req,res)=>{
  const {image,style="animador",energy="media"}=req.body||{};
  if(!image?.startsWith("data:image/")) return res.status(400).json({ok:false,error:"Falta una imagen válida."});
  if(!OPENAI_API_KEY) return res.status(503).json({ok:false,error:"El análisis de imágenes necesita configurar OPENAI_API_KEY en Render."});
  try{
    const prompt=`Analiza esta imagen publicitaria y crea un guion breve, claro y atractivo para un animador en español. Extrae solamente información visible o razonablemente legible: nombre del negocio/evento, fecha, hora, lugar, precios, promociones, artistas, productos y llamados a la acción. No inventes datos. Estilo: ${style}. Energía: ${energy}. Devuelve únicamente el guion final, sin explicaciones ni listas.`;
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":`Bearer ${OPENAI_API_KEY}`},
      body:JSON.stringify({model:OPENAI_MODEL,input:[{role:"user",content:[{type:"input_text",text:prompt},{type:"input_image",image_url:image}]}]})
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data?.error?.message||"Error del servicio de IA.");
    const script=data.output_text?.trim();
    if(!script) throw new Error("La IA no devolvió un guion.");
    res.json({ok:true,script,engine:"vision-ai"});
  }catch(e){res.status(500).json({ok:false,error:e.message||"No se pudo analizar la imagen."});}
});

app.post("/api/voice/generate",(req,res)=>res.status(501).json({ok:false,error:"Motor de voz IA todavía no conectado.",nextStep:"Conectar un proveedor TTS/voice-cloning mediante variables de entorno seguras."}));

app.listen(PORT,()=>console.log(`Animador IA Backend escuchando en puerto ${PORT}`));
