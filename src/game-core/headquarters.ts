export const headquartersStages=[
 {name:'Escritório inicial',image:'office',rooms:['Escritório compartilhado','Bancada de treino'],alt:'Escritório compacto com mesas de treinamento junto às janelas.'},
 {name:'Sala de treinamento',image:'studio',rooms:['Sala dedicada de treino','Administração','Sala de reuniões'],alt:'Sala de treinamento com mesas organizadas e sala de reunião envidraçada.'},
 {name:'Gaming house profissional',image:'house',rooms:['Treinamento dedicado','Área para treinadores','Convivência'],alt:'Gaming house com estações de treinamento, mesa de revisão e área de convivência.'},
 {name:'Centro de treinamento',image:'campus',rooms:['Salas de treino separadas','Análise de partidas','Administração e reuniões'],alt:'Centro de treinamento com salas envidraçadas e áreas de análise.'},
] as const;

export function headquartersStage(trainingLevel:number){
 return headquartersStages[trainingLevel]??headquartersStages[0];
}
