if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('rescisao-form');
    
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const salario = parseFloat(document.getElementById('salario').value);
            const dataInicio = new Date(document.getElementById('data-inicio').value + 'T00:00:00');
            const dataDemissao = new Date(document.getElementById('data-demissao').value + 'T00:00:00');
            const motivo = document.getElementById('motivo').value;
            const aviso = document.getElementById('aviso-previo').value;
            
            const resultados = calcularRescisaoCLT(salario, dataInicio, dataDemissao, motivo, aviso);
            exibirResultados(resultados);
        });
    }
});
}

function calcularRescisaoCLT(salario, dataInicio, dataDemissao, motivo, aviso) {
    if (dataInicio >= dataDemissao) {
        return { erro: "A data de demissão deve ser posterior à data de início." };
    }

    const umDiaEmMs = 1000 * 60 * 60 * 24;
    const diasTrabalhados = Math.floor((dataDemissao - dataInicio) / umDiaEmMs);
    const anosCompletos = Math.floor(diasTrabalhados / 365.25);
    
    let diasAviso = 0;
    if (motivo === 'sem_justa_causa' && aviso === 'indenizado') {
        diasAviso = 30 + (anosCompletos * 3);
        if (diasAviso > 90) diasAviso = 90;
    }

    const dataProjetada = new Date(dataDemissao.getTime() + (diasAviso * umDiaEmMs));

    // 1. Saldo de Salário
    const diasMesDemissao = dataDemissao.getDate();
    let saldoSalario = (salario / 30) * diasMesDemissao;

    // 2. 13º Salário Proporcional
    let meses13 = dataProjetada.getMonth() + 1; 
    if (dataProjetada.getDate() < 15) {
        meses13 -= 1;
    }
    if (dataInicio.getFullYear() === dataProjetada.getFullYear()) {
        let mesesDesconto = dataInicio.getMonth();
        if (dataInicio.getDate() > 16) mesesDesconto += 1;
        meses13 = Math.max(0, meses13 - mesesDesconto);
    }
    let decimoTerceiro = (salario / 12) * meses13;

    // 3. Férias Vencidas e Proporcionais
    const tempoTotalMeses = (dataProjetada.getFullYear() - dataInicio.getFullYear()) * 12 + (dataProjetada.getMonth() - dataInicio.getMonth());
    let diasRestantesParaMes = dataProjetada.getDate() - dataInicio.getDate();
    
    let mesesParaFerias = tempoTotalMeses;
    if (diasRestantesParaMes >= 15) {
        mesesParaFerias += 1;
    } else if (diasRestantesParaMes < 0) {
        const diasNoMesAnterior = new Date(dataProjetada.getFullYear(), dataProjetada.getMonth(), 0).getDate();
        const diasEfetivos = (diasNoMesAnterior - dataInicio.getDate()) + dataProjetada.getDate();
        if (diasEfetivos < 15) {
            mesesParaFerias -= 1;
        }
    }

    const periodosVencidos = Math.floor(mesesParaFerias / 12);
    const mesesProporcionais = mesesParaFerias % 12;

    let feriasVencidas = periodosVencidos * salario;
    let tercoFeriasVencidas = feriasVencidas / 3;

    let feriasProporcionais = (salario / 12) * mesesProporcionais;
    let tercoFeriasProporcionais = feriasProporcionais / 3;

    // 4. Aviso Prévio Indenizado
    let valorAvisoIndenizado = 0;
    if (motivo === 'sem_justa_causa' && aviso === 'indenizado') {
        valorAvisoIndenizado = (salario / 30) * diasAviso;
    }

    // 5. FGTS e Multa (Simplificado p/ fins didáticos de calculadora online)
    const mesesTrabalhadosTotal = Math.floor(diasTrabalhados / 30.41);
    const baseFgts = salario * 0.08 * mesesTrabalhadosTotal;
    let multaFgts = 0;
    if (motivo === 'sem_justa_causa') {
        multaFgts = baseFgts * 0.40;
    }

    // 6. Descontos
    const inss = (saldoSalario + decimoTerceiro) * 0.075; 
    let descontoAviso = 0;
    if (motivo === 'pedido_demissao' && aviso === 'nao_cumprido') {
        descontoAviso = salario; 
    }
    const totalDescontos = inss + descontoAviso;

    if (motivo === 'justa_causa') {
        const inssJustaCausa = saldoSalario * 0.075;
        return {
            saldoSalario, feriasVencidas, tercoFeriasVencidas,
            totalDescontos: inssJustaCausa,
            totalLiquido: saldoSalario + feriasVencidas + tercoFeriasVencidas - inssJustaCausa
        };
    } else if (motivo === 'pedido_demissao') {
        valorAvisoIndenizado = 0;
        multaFgts = 0;
    }

    const proventos = saldoSalario + decimoTerceiro + feriasVencidas + tercoFeriasVencidas + feriasProporcionais + tercoFeriasProporcionais + valorAvisoIndenizado + multaFgts;
    const totalLiquido = proventos - totalDescontos;

    return {
        saldoSalario, decimoTerceiro, feriasVencidas, tercoFeriasVencidas,
        feriasProporcionais, tercoFeriasProporcionais, valorAvisoIndenizado,
        multaFgts, totalDescontos, totalLiquido
    };
}

function exibirResultados(res) {
    const container = document.getElementById('results');
    
    if (res.erro) {
        container.innerHTML = `<p class="negative" style="font-weight: 500;">${res.erro}</p>`;
        container.classList.remove('hidden');
        return;
    }

    const formatBRL = (val) => (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    let html = `<h2>Resumo da Rescisão</h2><ul>`;
    
    if (res.saldoSalario > 0) html += `<li><span>Saldo de Salário:</span> <strong class="positive">${formatBRL(res.saldoSalario)}</strong></li>`;
    if (res.decimoTerceiro > 0) html += `<li><span>13º Salário Proporcional:</span> <strong class="positive">${formatBRL(res.decimoTerceiro)}</strong></li>`;
    
    const totalFeriasVenc = (res.feriasVencidas || 0) + (res.tercoFeriasVencidas || 0);
    if (totalFeriasVenc > 0) html += `<li><span>Férias Vencidas + 1/3:</span> <strong class="positive">${formatBRL(totalFeriasVenc)}</strong></li>`;
    
    const totalFeriasProp = (res.feriasProporcionais || 0) + (res.tercoFeriasProporcionais || 0);
    if (totalFeriasProp > 0) html += `<li><span>Férias Proporcionais + 1/3:</span> <strong class="positive">${formatBRL(totalFeriasProp)}</strong></li>`;
    
    if (res.valorAvisoIndenizado > 0) html += `<li><span>Aviso Prévio Indenizado:</span> <strong class="positive">${formatBRL(res.valorAvisoIndenizado)}</strong></li>`;
    if (res.multaFgts > 0) html += `<li><span>Multa 40% FGTS (Aprox):</span> <strong class="positive">${formatBRL(res.multaFgts)}</strong></li>`;
    if (res.totalDescontos > 0) html += `<li><span>Descontos (INSS/Aviso):</span> <strong class="negative">-${formatBRL(res.totalDescontos)}</strong></li>`;
    
    html += `</ul><div class="total"><span>Total Líquido:</span> <span>${formatBRL(res.totalLiquido)}</span></div>`;
    
    container.innerHTML = html;
    container.classList.remove('hidden');
    container.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Para exportação em ambiente de teste Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calcularRescisaoCLT };
}
