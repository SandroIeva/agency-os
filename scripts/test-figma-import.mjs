import assert from 'node:assert/strict';
import { figmaToItems, fitItems } from '../server/figma.js';
const box = { x: 0, y: 0, width: 1200, height: 800 };
const bg = (radius = 24, extra = {}) => ({ type: 'BACKGROUND_BLUR', radius, ...extra });
const white = alpha => ({ type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 }, opacity: alpha });
const rect = extra => ({ type: 'RECTANGLE', absoluteBoundingBox: box, fills: [white(.2)], effects: [bg()], ...extra });
const convert = node => figmaToItems(node, {newId: (() => { let id=0; return () => String(++id); })()});
const glass = convert(rect({ opacity: .75, cornerRadius: 16 }));
assert.equal(glass.items[0].bgBlur,24);
assert.equal(glass.items[0].fillAlpha,20);
assert.equal(glass.items[0].opacity,.75);
assert.equal(glass.items[0].radius,16);
assert.deepEqual(glass.warnings,[]);
assert.equal(glass.items[0].blur,undefined);
const fitted=fitItems(JSON.parse(JSON.stringify(glass.items)),glass.size,{w:600,h:400});
assert.equal(fitted.scale,.5);
assert.equal(fitted.items[0].bgBlur,12);
assert.equal(fitted.items[0].fillAlpha,20);
assert.equal(fitted.items[0].opacity,.75);
assert.equal(fitted.items[0].radius,8);
assert.equal(glass.items[0].bgBlur,24,'fit must not mutate cached imports');
assert.equal(fitItems(glass.items,glass.size,{w:2400,h:1600}).items[0].bgBlur,24);
const clear=convert(rect({type:'FRAME',fills:[],children:[{type:'TEXT',absoluteBoundingBox:box,characters:'Clear text',style:{fontSize:20},fills:[white(1)]}]}));
assert.equal(clear.items.length,2);
assert.equal(clear.items[0].fill,'transparent');
assert.equal(clear.items[0].bgBlur,24);
assert.equal(clear.items[1].text,'Clear text');
assert.equal(clear.items[1].bgBlur,undefined);
assert.equal(convert(rect({type:'FRAME',fills:[white(0)]})).items[0].fill,'transparent');
assert.equal(convert(rect({type:'FRAME',fills:[],effects:[]})).items.length,0);
assert.equal(convert(rect({effects:[bg(24,{visible:false})]})).items[0].bgBlur,undefined);
assert.equal(convert(rect({effects:[bg(0)]})).items[0].bgBlur,undefined);
const both=convert(rect({effects:[bg(10),{type:'LAYER_BLUR',radius:3},{type:'DROP_SHADOW',radius:6,offset:{x:0,y:4},color:{r:0,g:0,b:0,a:.4}}]}));
assert.equal(both.items[0].bgBlur,10); assert.equal(both.items[0].blur,3); assert.equal(both.items[0].shadow.blur,6);
const ellipse=convert(rect({type:'ELLIPSE'})); assert.equal(ellipse.items[0].bgBlur,24);
const image=convert(rect({fills:[{type:'IMAGE',imageRef:'test',scaleMode:'FIT'}],rectangleCornerRadii:[4,8,12,16]}));
assert.equal(image.items[0].bgBlur,24); assert.deepEqual(image.items[0].radii,[4,8,12,16]); assert.equal(image.images[0].imageRef,'test');
const progressive=convert(rect({effects:[bg(30,{blurType:'PROGRESSIVE',startRadius:0}),bg(10)]}));
assert.equal(progressive.items[0].bgBlur,30);
assert.deepEqual(progressive.warnings.map(w=>w.kind),['background-blur-stack','background-blur-progressive']);
const nested=convert({type:'FRAME',absoluteBoundingBox:box,opacity:.5,fills:[],children:[rect({opacity:.5})]});
assert.equal(nested.items[0].opacity,.25); assert.equal(nested.items[0].fillAlpha,20);
assert.equal(convert(rect({fills:[white(1)],effects:[]})).items[0].opacity,undefined);
console.log('Passed: glass panels, transparent frames, nested opacity, images, ellipses, disabled effects, layer blur/shadows, scaling and unsupported-effect warnings.');

// Stroke paint opacity and color alpha are independent of fill/node opacity.
const stroke = (opacity, alpha = 1) => ({type:'SOLID', color:{r:1,g:0,b:0,a:alpha}, ...(opacity == null ? {} : {opacity})});
for (const type of ['RECTANGLE','ELLIPSE','FRAME']) {
  const item = convert(rect({type, opacity:.8, strokeWeight:4, strokes:[stroke(.4,.5)]})).items[0];
  assert.equal(item.strokeAlpha,20);
  assert.equal(item.fillAlpha,20);
  assert.equal(item.opacity,.8);
  assert.equal(item.bgBlur,24);
  const scaled = fitItems([item],{w:1200,h:800},{w:600,h:400}).items[0];
  assert.equal(scaled.strokeAlpha,20);
  assert.equal(scaled.strokeWidth,2);
}
for (const [paint, expected] of [[stroke(0),0],[stroke(null),100],[stroke(.125),12.5]]) {
  assert.equal(convert(rect({strokeWeight:2,strokes:[paint]})).items[0].strokeAlpha,expected);
}
assert.equal(convert(rect({strokeWeight:2,strokes:[{...stroke(.5),visible:false}]})).items[0].strokeAlpha,undefined);
const outlinedFrame=convert(rect({type:'FRAME',fills:[],effects:[],strokeWeight:2,strokes:[stroke(.3)]})).items[0];
assert.equal(outlinedFrame.fill,'transparent'); assert.equal(outlinedFrame.strokeAlpha,30);
const outlinedImage=convert(rect({fills:[{type:'IMAGE',imageRef:'image'}],strokeWeight:2,strokes:[stroke(.6)]})).items[0];
assert.equal(outlinedImage.strokeAlpha,60);
console.log('Passed: stroke opacity, color alpha, zero/default/fractional alpha, hidden strokes, image/frame outlines and scaling.');

// Figma has already resolved auto layout. Preserve the boxes and draw the
// background, then editable children, then the frame's outline.
for (const mode of ['NONE','HORIZONTAL','VERTICAL','GRID']) {
  const child=rect({absoluteBoundingBox:{x:124,y:222,width:100,height:40},effects:[],fills:[white(1)]});
  const tree=rect({type:'FRAME',layoutMode:mode,absoluteBoundingBox:{x:100,y:200,width:360,height:120},cornerRadius:30,strokeWeight:2,strokes:[stroke(.5)],children:[child]});
  const result=convert(tree);
  assert.equal(result.items.length,3);
  assert.equal(result.items[0].fillAlpha,20);
  assert.equal(result.items[0].strokeWidth,undefined);
  assert.deepEqual([result.items[1].x,result.items[1].y,result.items[1].w,result.items[1].h],[24,22,100,40]);
  assert.equal(result.items[2].fill,'transparent');
  assert.equal(result.items[2].radius,30);
  assert.equal(result.items[2].strokeAlpha,50);
  assert.equal(result.convertedAutoLayouts,mode==='NONE'?0:1);
  assert.ok(!result.warnings.some(w=>w.kind==='auto-layout'));
}
const red=rect({fills:[stroke(1)],effects:[]});
const green=rect({fills:[{type:'SOLID',color:{r:0,g:1,b:0}}],effects:[]});
const stackTree=rect({type:'FRAME',layoutMode:'HORIZONTAL',itemReverseZIndex:true,fills:[],effects:[],children:[red,green]});
assert.deepEqual(convert(stackTree).items.map(i=>i.fill),['#00ff00','#ff0000']);
assert.deepEqual(stackTree.children,[red,green],'Do not mutate cached source order');
const imageFrame=convert(rect({type:'FRAME',layoutMode:'VERTICAL',fills:[{type:'IMAGE',imageRef:'photo'}],strokeWeight:2,strokes:[stroke(.4)],children:[red]}));
assert.deepEqual(imageFrame.items.map(i=>i.type),['image','rect','rect']);
assert.equal(imageFrame.items[2].strokeAlpha,40);
assert.equal(imageFrame.images[0].id,imageFrame.items[0].id);
assert.equal(imageFrame.convertedAutoLayouts,1);
console.log('Passed: auto-layout/native frames, editable background and front outline, resolved positions, image frames and reversed stacking.');
