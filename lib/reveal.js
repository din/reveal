(function($)
{
    "use strict";

    function dragonise(el, options)
    {
        options = $.extend({ "context" : null, "press" : null, "move" : null, "release" : null }, options);
        
        el.on("mousedown touchstart", function(ev)
        {
            //We don't want scroll and anything else to work during swipe
            ev.preventDefault();

            //Storing initial coordinates
            var pressPoint = { pageX : ev.originalEvent.touches ? ev.originalEvent.touches[0].pageX : ev.pageX,
                               pageY : ev.originalEvent.touches ? ev.originalEvent.touches[0].pageY : ev.pageY };

            if (options.press) options.press.call(el,  options.context);

            //Attaching events listeners
            $(document).on("mousemove.dragonise touchmove.dragonise", function(ev)
            {
                ev.preventDefault();

                var data = {};

                //Storing deltas relative to the first mouse press or touch
                data["dx"] = pressPoint.pageX - (ev.originalEvent.touches ? ev.originalEvent.touches[0].pageX : ev.pageX);
                data["dy"] = pressPoint.pageY - (ev.originalEvent.touches ? ev.originalEvent.touches[0].pageY : ev.pageY);

                //Storing absolute values for our deltas
                data["adx"] = Math.abs(data.dx);
                data["ady"] = Math.abs(data.dy);

                data["direction"] = { x : data.dx >= 0 ? 1 : -1,
                                   y : data.dy >= 0 ? 1 : -1 };


                //Calling movement handler
                if (options.move) options.move.call(el, data, options.context);


            }).on("mouseup.dragonise touchend.dragonise", function(ev)
            {
                $(document).off(".dragonise");
                if (options.release) options.release.call(el, options.context);
            });  
        })
    }

    function appendRevealDocument(raw_actions)
    {
        //Don't append reveal more than once
        $(".reveal-doc-container").remove();

        /* Preparing input values */

        if (typeof raw_actions === "undefined") throw "Invalid input arguments.";

        var actions = {},
            append_offscreen = false,
            body = $("body"),
            defaults = { "content" : null, 
                         "id" : null,
                         "inactive_size" : 30,
                         "activation_size" : 0.3,
                         "container_size" : 200 };

        for (var name in raw_actions)
        {
            var current_action = raw_actions[name];
            if (current_action == null || current_action == true) current_action = {};

            //Storing default properties for every attachment
            current_action = $.extend({}, defaults, current_action);

            current_action.attachment = name;
            current_action.size = (name === "left" || name === "right") ? "width" : "height";
            current_action.container = $("<div><div /></div>");
            current_action.subcontainer = $("> div", current_action.container);

            //Appending content element if necessary
            //Otherwise it is possible to append children directly to the container with the appropriate name
            if (current_action.content != null)
            { 
                if (typeof current_action.content === "function")
                {
                    current_action.content.call(current_action.subcontainer, current_action);
                }
                else
                {
                    //TODO: type testing
                    current_action.subcontainer.append(current_action.content);
                }
            }   

            if (current_action.id != null) current_action.container.attr("id", current_action.id);
            if (current_action.offscreen == true) append_offscreen = true;

            //Setting default size of the container for the attachment
            current_action.container.attr("class", "reveal-doc-container reveal-doc-container-" + name);
            current_action.container.css(current_action.size, current_action.inactive_size);

            actions[name] = current_action;
        }

        /* Functions */

        function initialiseContainer(ctx)
        {
            if (ctx.activated == true) return;

            var container = ctx.container,
                subcontainer = ctx.subcontainer,
                container_css = {},
                subcontainer_css = {};

            container_css[ctx.attachment] = -ctx.container_size;
            container_css[ctx.size] = ctx.container_size;

            subcontainer_css[ctx.size] = ctx.container_size;

            container.css(container_css).addClass("reveal-doc-container-vis");
            subcontainer.css(subcontainer_css); 
        }

        function moveContainer(data, ctx)
        {
            if (ctx.activated == true) return;

            var container = ctx.container,
                container_size = ctx.container_size,
                activation_size = ctx.activation_size,
                offset = ctx.size == "width" ? data.dx : data.dy, 
                direction = data.direction[ctx.size == "width" ? "x" : "y"];

            var container_pos = -ctx.container_size - (-direction * offset),
                raw_container_pos = container_pos,
                container_dim = ctx.container_size;
            
            //Applying constraints when shown the whole container.
            //Making it feel lossy a little bit
            if (container_pos >= 0) 
            {
                container_pos = 0;
                container_dim = container_dim + ((raw_container_pos - container_pos) / 14);
            }

            //Animating container properties
            var container_properties = {};
            container_properties[ctx.attachment] = container_pos;
            container_properties[ctx.size] = container_dim;

            container.css(container_properties);
        }

        function hideContainer(ctx, force_deactivate)
        {
            if (ctx.activated == true && typeof force_deactivate === "undefined") return;

            var container = ctx.container,

                container_computed_size = ctx.size == "width" ? container.width() : container.height(),

                activation_size = ctx.activation_size <= 1 ? container_computed_size * ctx.activation_size 
                                                           : ctx.activation_size,

                activated = container_computed_size >= activation_size - parseInt(container.css(ctx.attachment)),

                restored_properties = {}


            //If we are being forced to deactivate the current container, we must ignore the computed values
            //This is used when users click outside the container
            if (typeof force_deactivate !== "undefined") activated = false;

            //Setting animation properties
            //The container's position is always restored to zero
            //The container's size is zero if we are going to hide it or the actual container size
            restored_properties[ctx.attachment] = 0;
            restored_properties[ctx.size] = activated ? ctx.container_size : 0;

            container.animate(restored_properties, {duration : activated ? 400 : 300, 
                                                    easing: "easeInOutSine",
                                                    complete: function()
            {
                restored_properties[ctx.size] = ctx.inactive_size;

                if (activated == false)
                {
                    container.css(restored_properties).removeClass("reveal-doc-container-vis");
                }
            }});

            if (activated == true)
            {
                $(document).on("mousedown.reveal-release", function(ev)
                {
                    if (container.is(ev.target) || container.has(ev.target).length > 0) return;

                    hideContainer(ctx, true);
                    $(document).off(".reveal-release");
                });
            }

            ctx.activated = activated;
        }

        /* Appending containers and event listeners */

        for (var name in actions)
        {
            var current_action = actions[name];

            dragonise(current_action.container, {
                "context" : current_action,

                "press" : initialiseContainer,
                "release" : hideContainer,
                "move" : moveContainer
            });

            body.append(current_action.container);
        }
    }

    function appendRevealActions(raw_actions, defaults)
    {
        /* Preparing input values */

        if (typeof raw_actions !== "object") throw "Invalid input arguments.";
        if (typeof defaults === "undefined") defaults = {};

        var actions = $.extend({"left" : [], "right" : [], "top" : [], "bottom" : []}, raw_actions);

        //Actions can be specified as an array of values or as a single string, if there is only a single action
        //Actions can also be objects instead of strings, and they will be attached properly
        for (var attachment in actions)
        {
            actions[attachment] = typeof actions[attachment] === "string" ? [actions[attachment]] : actions[attachment];
        }

        //See documentation for the detailed description of the values below
        defaults = $.extend({"complete" : null,
                             "cancel" : null,
                             "activation_threshold" : 0.4, 
                             "offscreen_element_size" : 0.5,
                             "action_element_size" : 0.5,
                             "action_css_prefix" : "reveal-action-" }, defaults);

        //Orientation is detected automatically
        if ((actions.left.length == 0 && actions.right.length == 0) &&
            (actions.top.length > 0 || actions.bottom.length > 0))
        { 
            defaults["orientation"] = "v";
        }
        else
        {
            defaults["orientation"] = "h";
        }

        //UI elements to be created
        var ui = {
            el : $(this),
            wrapper : null,
            offscreen : null,
            label : null,
        },
            model = {
            accept_events : true,
            has_threshold : false,
            current_action : null,
            current_attachment : null,
            previous_action : null
        };

        //Marking the root element as ours
        //This class prevents text to be selected inside the element
        ui.el.addClass("reveal-root");

        /* Handling gestures */

        dragonise(ui.el, {"press" : function() 
        {
            if (model.accept_events == false) return;

            ui.el.contents().wrapAll("<div class='reveal-content'></div>"); 
            ui.el.append("<div class='reveal-offscreen'><strong class='reveal-label'></strong></div>");

            ui.wrapper = $(".reveal-content", ui.el).stop(true, true);;
            ui.offscreen = $(".reveal-offscreen", ui.el);
            ui.label = $("strong", ui.offscreen);

            //Preventing mouse cursor to be changed
            $("body, html").addClass("reveal-body");

            //Resetting previous model values for actions and attachments
            model.current_action = null;
            model.current_attachment = null;
            model.previous_action = null;

            //Checking if we need to unfold attachment function for the current element
            for (var attachment in raw_actions)
            {
                if (typeof raw_actions[attachment] === "function")
                {
                    actions[attachment] = raw_actions[attachment].call(ui.el[0]);
                    actions[attachment] = typeof actions[attachment] === "string" ? [actions[attachment]] : actions[attachment];
                }
            }

        }, "release" : function() 
        {
            if (model.accept_events == false || ui.offscreen == null) return;
            model.accept_events = false;

            //Storing elements, because we delete them globally before animation finishes
            var wrapper = ui.wrapper, offscreen = ui.offscreen;  

            //Checking if we need a special transition if user selected an action
            if (model.current_action == null)
            {
                //No action selected, just returning the element to its initial state
                var animation = defaults.orientation == "h" ? { "width": 0 } : { "height": 0 };
                offscreen.animate(animation, {duration: 800, easing: "easeOutElastic", queue: false});

                wrapper.animate({"left" : 0, "top" : 0}, 
                                {duration: 800, easing: "easeOutElastic", queue: false, complete: function()
                {
                    //Calling a callback if we must
                    if (typeof defaults.cancel === "function")
                    {
                        defaults.cancel({"element" : ui.el});
                    }

                    offscreen.remove();
                    wrapper.contents().unwrap();

                     model.accept_events = true;
                }});  

                model.current_action = null;
                model.current_attachment = null;
                model.previous_action = null;
            }
            else
            {
    
                //Creating the animation according to the attachment of the current action
                var animation = {}, duration = 330;
                switch (model.current_attachment)
                {
                    case "right": animation = { "left": -wrapper.width() }; break;
                    case "left": animation = { "left": wrapper.width() }; break;
                    case "top": animation = { "top": wrapper.height() }; break;
                    case "bottom": animation = { "top": -wrapper.height() }; break;
                }

                //Setting proper offscreen size
                if (model.current_attachment == "top" || model.current_attachment == "bottom")
                {
                    offscreen.animate({ "width": ui.el.innerWidth(), 
                                        "height" : ui.el.innerHeight() }, duration);
                }
                else
                {
                     offscreen.animate({ "width": ui.el.innerWidth(), 
                                        "height" : ui.el.innerHeight() }, duration);
                }

                //Executing the animation
                wrapper.animate(animation,
                                {duration : duration, easing : "easeOutCubic", complete : function()
                {

                    //Fading out user's choise after a short delay
                    setTimeout(function()
                    {
                        offscreen.fadeOut(150, function()
                        {
                             //Calling a callback if we must
                            if (typeof defaults.complete === "function")
                            {
                                defaults.complete({"action" : model.current_action, 
                                                   "attachment" : model.current_attachment,
                                                   "element" : ui.el, 
                                                   "wrapper" :wrapper});
                            }

                            model.current_action = null;
                            model.current_attachment = null;
                            model.previous_action = null;

                            offscreen.remove();
                            wrapper.contents().unwrap();

                            model.accept_events = true;
                        });
                    }, 300);
                }});
            }

            $("body, html").removeClass("reveal-body");

            ui.wrapper = null;
            ui.offscreen = null;
            ui.label = null;
                      
        }, "move" : function(data) 
        { 
            if (model.accept_events == false || ui.offscreen == null) return;                 

            var offset = defaults.orientation == "h" ? data.dx : data.dy, 
                raw_offset = offset,
                direction = data.direction[defaults.orientation == "h" ? "x" : "y"],
            
                element_size = defaults.orientation == "h" ? ui.el.width() : ui.el.height(),

                action_element_size = defaults.action_element_size <= 1 
                                        ? defaults.action_element_size * element_size 
                                        : defaults.action_element_size,
               
                offscreen_element_size = defaults.offscreen_element_size <= 1 
                                        ? element_size * defaults.offscreen_element_size 
                                        : defaults.offscreen_element_size,

                activation_threshold = defaults.activation_threshold <= 1 
                                        ? element_size * defaults.activation_threshold 
                                        : defaults.activation_threshold,

                threshold_changed = (model.has_threshold != (Math.abs(offset) >= activation_threshold)),

                attachment = defaults.orientation == "h" ? (direction > 0 ? "right" : "left") 
                                                         : (direction < 0 ? "top" : "bottom"),
                
                current_actions = actions[attachment];

            //We must save this to optimise further DOM operations
            model.has_threshold = Math.abs(offset) >= activation_threshold;

            //Applying constraints
            if (current_actions.length == 0) offset = 0;
            if (Math.abs(offset) < 0) offset = 0;
            if (Math.abs(offset) > offscreen_element_size) offset = direction * offscreen_element_size;
            offset = offset + ((raw_offset - offset) / 8);

            //Getting current action by evaluating the raw offset.
            if (current_actions.length > 0)
            {
                var current_action_index = -1;
                current_action_index = Math.floor((Math.abs(offset) - (Math.abs(offset) > 10 ? 10 : 0)) / action_element_size);
                current_action_index = Math.min(current_action_index, current_actions.length-1);

                if (threshold_changed == true || model.previous_action != current_actions[current_action_index])
                {
                    var current_action = current_actions[current_action_index],
                        current_action_title = "",
                        current_action_class_name = "";

                    if (current_action instanceof HTMLElement)
                    {
                        current_action_title = current_action.getAttribute("data-name");
                    }
                    else
                    {
                        current_action_title = current_action;
                    }

                    current_action_class_name = current_action_title.replace(/\W+/g, "-").toLowerCase();

                    if (model.has_threshold == true)
                    {  
                        model.current_attachment = attachment;
                        model.current_action = current_actions[current_action_index];  

                        ui.offscreen.attr("class", "reveal-offscreen reveal-offscreen-" + attachment);
                        ui.offscreen.addClass(defaults.action_css_prefix + current_action_class_name);
                    }
                    else
                    {
                        model.current_attachment = null;
                        model.current_action = null;

                        ui.offscreen.attr("class", "reveal-offscreen reveal-offscreen-" + attachment);
                    }
                    
                    //Setting label's text
                    ui.label.contents().remove();
                    if (current_action instanceof HTMLElement)
                    {
                        ui.label.append(current_action);
                    }
                    else
                    {
                        ui.label.text(current_action_title);
                    }
                } 
               
                ui.offscreen.css( defaults.orientation == "h" 
                                    ? { "width" : Math.abs(offset) } 
                                    : { "height" : Math.abs(offset) } );


                model.previous_action = current_actions[current_action_index];
            }
            else
            {
                ui.offscreen.css( defaults.orientation == "h" ? { "width" : 0 } 
                                                              : { "height" : 0 } );
            }

            //Rendering position of wrapper on-screen
            ui.wrapper.css(defaults.orientation == "h" ? "left" : "top", -offset);
        }});
    }

    $.fn.revealContext = function()
    {
        var args = arguments;

        if (this.is($(document)) || this.is($("body")))
        {
            appendRevealDocument.apply(this, args);
        }
        else
        {
            return this.each(function() 
            {
                appendRevealActions.apply(this, args);
            });
        }
    }

})(jQuery);