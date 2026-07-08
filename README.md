# Naruto RPG — Sistema para Foundry VTT

Sistema não-oficial de RPG baseado no universo **Naruto**, implementando as regras do **Naruto RPG** (Jansen Victorino Azevedo) e do **Livro de Expansão**, para **Foundry VTT v13+**.

Baseado no sistema [Street Fighter RPG](https://github.com/3darkman/street-fighter) de Kirlian Silvestre (licença MIT), que implementa o motor Storyteller (parada de dados d10, dificuldade 6+).

## Características

- **Ficha de Shinobi completa**: Atributos (Físicos, Sociais, Mentais), Habilidades (Talentos, Perícias, Conhecimentos), Técnicas de combate (Soco, Chute, Bloqueio, Apresar, Esportes, Focus), Antecedentes, Honra e Glória
- **Recursos**: Saúde, Chakra e Força de Vontade com barras visuais
- **Jutsus** com cálculo automático de Velocidade, Dano e Movimento
- **Estilos de Artes Ninja** (Ninjutsu, Genjutsu, Taijutsu e outros) com Chakra e Força de Vontade iniciais
- **Ranks Ninja** (Estudante da Academia, Genin, Chuunin, Jounin, ANBU, Kage)
- **Combate por fases**: Seleção secreta de manobras → Execução por ordem de velocidade
- **Efeitos Ativos**: modificadores de características, recursos, rolagens e jutsus
- **Sistema de rolagem** Storyteller: Atributo + Habilidade/Técnica em d10

## Instalação

1. No Foundry VTT, vá em **Configuration → Game Systems → Install System**
2. Cole o Manifest URL:

```
https://github.com/Parra-Parrudo/naruto-rpg/releases/latest/download/system.json
```

3. Clique em **Install**

## Idiomas

- 🇧🇷 Português (Brasil)
- 🇺🇸 English

## Roadmap

- [x] **Fase 1** — Conversão de identidade e terminologia (Street Fighter → Naruto RPG)
- [x] Conteúdo oficial embutido: características, Estilos de Artes Ninja, Ranks, Armas, Equipamentos e regras de combate (botão "Conteúdo Oficial")
- [x] **Fase 2** — Jutsus do Livro Básico e da Expansão (428 jutsus com pré-requisitos e custos estruturados)
- [x] **Fase 3** — Mecânicas da Expansão (Hachimon Tonkou, Selo Amaldiçoado, Modo Sennin, Transformações de Bijuu, Afinidade Elemental)
- [x] **Fase 4** — Ferramentas de mesa: Cartas de Combate (mão + Mesa de Combate) e cadeado de ficha (GM trava/destrava edição)
- [x] **Fase 5** — Criador de Personagens nativo (distribuição por pools + etapa dedicada de Pontos de Bônus) e importação de personagens (arquivo `.fscharacters` ou código `NRPG1|` colado)
- [x] **Fase 6** — Sistema de Clãs: seleção por lista (Criador e ficha), Item de clã no Conteúdo Oficial, descrições em painéis expansíveis e **requisito de jutsus por clã**
- [ ] **Fase 7** — Tela de Evolução/XP (gastar XP em características e jutsus com os custos oficiais)
- [ ] Filtros de jutsus por Afinidade Elemental no compêndio
- [ ] NPCs prontos (Cap. 8 da Expansão) e aventuras (Cap. 11)

## Créditos

- **Sistema original (Street Fighter RPG para Foundry)**: Kirlian Silvestre — MIT License
- **Naruto RPG (livro base)**: Jansen Victorino Azevedo
- **Livro de Expansão e conversão**: Leandro Nagy

**Nota**: Naruto é marca registrada de Masashi Kishimoto / Shueisha. Este é um projeto de fã, não-oficial e sem fins lucrativos.

## Licença

[MIT License](LICENSE)
