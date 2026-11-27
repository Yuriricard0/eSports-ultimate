export const uniformPatterns=['lisa','faixa','listras','diagonal'] as const;
export const uniformVariants=['home','away'] as const;
export type UniformVariant=typeof uniformVariants[number];
export type Uniform={primary:string;secondary:string;detail:string;pattern:typeof uniformPatterns[number];crest:boolean;monogram:boolean;sponsor:string};
export type Uniforms=Partial<Record<UniformVariant,Uniform>>;
export function defaultUniform(primary:string,secondary:string,variant:UniformVariant):Uniform{
 return {primary:variant==='home'?primary:'#f4f2ed',secondary:variant==='home'?secondary:primary,detail:variant==='home'?'#ffffff':'#1a202b',pattern:'faixa',crest:true,monogram:true,sponsor:''};
}
export function validateUniform(input:unknown):Uniform{
 if(!input||typeof input!=='object')throw Error('Uniforme inválido.');
 const {primary,secondary,detail,pattern,crest,monogram,sponsor}=input as Uniform;
 if(![primary,secondary,detail].every(value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value))||
   !uniformPatterns.includes(pattern)||typeof crest!=='boolean'||typeof monogram!=='boolean'||typeof sponsor!=='string'||sponsor.length>80)
   throw Error('Confira as cores, o padrão e os detalhes do uniforme.');
 return {primary,secondary,detail,pattern,crest,monogram,sponsor};
}
