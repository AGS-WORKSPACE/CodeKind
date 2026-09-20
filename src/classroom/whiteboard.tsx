import{useCallback,useEffect,useRef,useState}from'react';
import{Eraser,Pen,RotateCcw,Trash2}from'lucide-react';
import type{BoardEvent,BoardLink,BoardStroke}from'./call';

const COLOURS=['#1f6f4f','#2b6cb0','#b4472f','#8a6a3b','#22303a'];
const WIDTHS={pen:3,eraser:26};
const ERASER='#eef1eb'; // the board's own colour, so rubbing out is drawing the background back

/* The board is kept as strokes rather than pixels: that lets it be redrawn at any size, undone,
   and sent to the other person as it is made. Points are fractions of the board, so two windows
   of different sizes draw the same picture. */
export function Whiteboard({link}:{link?:BoardLink}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const strokes=useRef<BoardStroke[]>([]);
 const drawing=useRef<BoardStroke|null>(null);
 const[tool,setTool]=useState<'pen'|'eraser'>('pen');
 const[colour,setColour]=useState(COLOURS[0]!);

 const paint=useCallback((stroke:BoardStroke,context:CanvasRenderingContext2D,width:number,height:number)=>{
  if(stroke.points.length<2)return;
  context.strokeStyle=stroke.colour;
  context.lineWidth=stroke.width;
  context.lineCap='round';
  context.lineJoin='round';
  context.beginPath();
  context.moveTo(stroke.points[0]!.x*width,stroke.points[0]!.y*height);
  for(const point of stroke.points.slice(1))context.lineTo(point.x*width,point.y*height);
  context.stroke();
 },[]);

 const redraw=useCallback(()=>{
  const board=canvas.current;
  const context=board?.getContext('2d');
  if(!board||!context)return;
  const{width,height}=board.getBoundingClientRect();
  const ratio=window.devicePixelRatio||1;
  if(board.width!==Math.round(width*ratio)||board.height!==Math.round(height*ratio)){
   board.width=Math.round(width*ratio);board.height=Math.round(height*ratio);
  }
  context.setTransform(ratio,0,0,ratio,0,0);
  context.clearRect(0,0,width,height);
  for(const stroke of strokes.current)paint(stroke,context,width,height);
  if(drawing.current)paint(drawing.current,context,width,height);
 },[paint]);

 // The board follows the panel's size, and is drawn again from its strokes at the new size.
 useEffect(()=>{
  redraw();
  const board=canvas.current;
  if(!board)return;
  const observer=new ResizeObserver(redraw);
  observer.observe(board);
  return()=>observer.disconnect();
 },[redraw]);

 // What the other person draws lands here.
 useEffect(()=>{
  if(!link)return;
  return link.subscribe((event:BoardEvent)=>{
   if(event.kind==='stroke')strokes.current=[...strokes.current,event.stroke];
   if(event.kind==='undo')strokes.current=strokes.current.filter(stroke=>stroke.id!==event.strokeId);
   if(event.kind==='clear')strokes.current=[];
   redraw();
  });
 },[link,redraw]);

 const at=(event:React.PointerEvent<HTMLCanvasElement>)=>{
  const box=event.currentTarget.getBoundingClientRect();
  return{x:(event.clientX-box.left)/box.width,y:(event.clientY-box.top)/box.height};
 };

 const start=(event:React.PointerEvent<HTMLCanvasElement>)=>{
  event.currentTarget.setPointerCapture(event.pointerId);
  drawing.current={id:crypto.randomUUID(),colour:tool==='eraser'?ERASER:colour,width:WIDTHS[tool],points:[at(event)]};
 };

 /* Coalesced events carry every point the mouse passed through between frames, which is what keeps
    a fast stroke on the cursor instead of trailing behind it in straight cuts. */
 const move=(event:React.PointerEvent<HTMLCanvasElement>)=>{
  const stroke=drawing.current;
  if(!stroke)return;
  // Some events carry no coalesced list, so the event's own point stands in for it.
  const coalesced=typeof event.nativeEvent.getCoalescedEvents==='function'?event.nativeEvent.getCoalescedEvents():[];
  const points=coalesced.length?coalesced.map(raw=>at({...event,clientX:raw.clientX,clientY:raw.clientY})):[at(event)];
  stroke.points.push(...points);
  redraw();
 };

 const finish=()=>{
  const stroke=drawing.current;
  drawing.current=null;
  if(!stroke||stroke.points.length<2)return;
  strokes.current=[...strokes.current,stroke];
  link?.send(stroke);
  redraw();
 };

 const undo=()=>{
  const last=strokes.current.at(-1);
  if(!last)return;
  strokes.current=strokes.current.slice(0,-1);
  link?.undo(last.id);
  redraw();
 };

 const clear=()=>{
  strokes.current=[];
  link?.clear();
  redraw();
 };

 return <div className="whiteboard">
  <div className="whiteboard-tools">
   <button type="button" className={tool==='pen'?'on':undefined} title="Pen" aria-pressed={tool==='pen'} onClick={()=>setTool('pen')}><Pen/></button>
   <button type="button" className={tool==='eraser'?'on':undefined} title="Eraser" aria-pressed={tool==='eraser'} onClick={()=>setTool('eraser')}><Eraser/></button>
   <span/>
   {COLOURS.map(swatch=><button type="button" key={swatch} className={`swatch${colour===swatch&&tool==='pen'?' on':''}`} title={`Draw in ${swatch}`}
    aria-label={`Draw in ${swatch}`} style={{background:swatch}} onClick={()=>{setColour(swatch);setTool('pen')}}/>)}
   <span/>
   <button type="button" title="Undo" onClick={undo}><RotateCcw/></button>
   <button type="button" title="Clear the board" onClick={clear}><Trash2/></button>
  </div>
  <canvas ref={canvas} onPointerDown={start} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish}/>
 </div>;
}
